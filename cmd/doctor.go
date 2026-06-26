package cmd

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"github.com/p31labs/p31-cli/internal/api"
	"github.com/p31labs/p31-cli/internal/config"
	"github.com/spf13/cobra"
	"golang.org/x/sync/errgroup"
)

var doctorCmd = &cobra.Command{
	Use:   "doctor",
	Short: "Run unified ecosystem diagnostics",
	Long: `One-shot friction check. All probes fire in parallel.

  p31 doctor            # quick checks only
  p31 doctor --mesh     # add strict mesh probe
  p31 doctor --verify   # chain p31 verify after green checks
  p31 doctor --fun      # print one joy line after passing
  p31 doctor --json     # machine-readable JSON output`,
	RunE: runDoctor,
}

var (
	doctorMesh   bool
	doctorVerify bool
	doctorFun    bool
	doctorJSON   bool
	doctorTimeout = 10 * time.Second
)

func init() {
	doctorCmd.Flags().BoolVar(&doctorMesh, "mesh", false, "run strict mesh probe")
	doctorCmd.Flags().BoolVar(&doctorVerify, "verify", false, "run p31 verify after green checks")
	doctorCmd.Flags().BoolVar(&doctorFun, "fun", false, "print operator joy line after passing")
	doctorCmd.Flags().BoolVar(&doctorJSON, "json", false, "machine-readable JSON output")
	rootCmd.AddCommand(doctorCmd)
}

type checkResult struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	Msg    string `json:"msg"`
}

func runDoctor(cmd *cobra.Command, args []string) error {
	results := make([]checkResult, 0)

	ctx, cancel := context.WithTimeout(context.Background(), doctorTimeout)
	defer cancel()

	g, gctx := errgroup.WithContext(ctx)

	g.Go(func() error {
		out, err := exec.CommandContext(gctx, "node", "--version").Output()
		if err != nil {
			return fmt.Errorf("node not found")
		}
		nv := strings.TrimSpace(string(out))
		major := regexp.MustCompile(`^v(\d+)`).FindStringSubmatch(nv)
		if len(major) == 0 || parseInt(major[1]) < 20 {
			return fmt.Errorf("Node 20+ required, got %s", nv)
		}
		results = append(results, checkResult{"node", "pass", nv})
		return nil
	})

	g.Go(func() error {
		out, err := exec.CommandContext(gctx, "git", "-C", "/home/p31/bonding-soup", "remote", "get-url", "origin").Output()
		if err != nil {
			return fmt.Errorf("no home origin")
		}
		results = append(results, checkResult{"git:home", "pass", strings.TrimSpace(string(out))})
		return nil
	})

	g.Go(func() error {
		out, err := exec.CommandContext(gctx, "gh", "api", "user", "--jq", ".login").Output()
		if err != nil {
			return fmt.Errorf("gh not authenticated")
		}
		results = append(results, checkResult{"gh", "pass", strings.TrimSpace(string(out))})
		return nil
	})

	g.Go(func() error {
		if _, err := os.Stat("/home/p31/andromeda/.git"); err != nil {
			return fmt.Errorf("andromeda: not a git checkout")
		}
		out, err := exec.CommandContext(gctx, "git", "-C", "/home/p31/andromeda", "remote", "get-url", "origin").Output()
		if err != nil {
			return fmt.Errorf("andromeda: no origin")
		}
		results = append(results, checkResult{"git:andromeda", "pass", strings.TrimSpace(string(out))})
		return nil
	})

	g.Go(func() error {
		if _, err := exec.CommandContext(gctx, "docker", "info").Output(); err != nil {
			return fmt.Errorf("Docker not reachable")
		}
		results = append(results, checkResult{"docker", "pass", "daemon reachable"})
		return nil
	})

	g.Go(func() error {
		if _, err := exec.CommandContext(gctx, "curl", "-sf", "http://127.0.0.1:11440/api/tags", "-o", "/dev/null").Output(); err == nil {
			results = append(results, checkResult{"ollama", "pass", ":11440 (cortex)"})
			return nil
		}
		if _, err := exec.CommandContext(gctx, "curl", "-sf", "http://127.0.0.1:11435/api/tags", "-o", "/dev/null").Output(); err == nil {
			results = append(results, checkResult{"ollama", "pass", ":11435 (cashpilot)"})
			return nil
		}
		if _, err := exec.CommandContext(gctx, "curl", "-sf", "http://127.0.0.1:11434/api/tags", "-o", "/dev/null").Output(); err == nil {
			results = append(results, checkResult{"ollama", "pass", ":11434"})
			return nil
		}
		results = append(results, checkResult{"ollama", "fail", "not reachable at :11440, :11435, or :11434"})
		return fmt.Errorf("Ollama not reachable at any known port")
	})

	g.Go(func() error {
		out, err := exec.CommandContext(gctx, "df", "-BG", "/home/p31").Output()
		if err != nil {
			return fmt.Errorf("df failed")
		}
		lines := strings.Split(strings.TrimSpace(string(out)), "\n")
		if len(lines) < 2 {
			return fmt.Errorf("unexpected df output")
		}
		fields := strings.Fields(lines[len(lines)-1])
		freeGB := parseInt(strings.TrimSuffix(fields[3], "G"))
		if freeGB < 5 {
			results = append(results, checkResult{"disk", "warn", fmt.Sprintf("%dGB free (need ≥5GB)", freeGB)})
			return nil
		}
		results = append(results, checkResult{"disk", "pass", fmt.Sprintf("%dGB free", freeGB)})
		return nil
	})

	g.Go(func() error {
		out, err := exec.CommandContext(gctx, "go", "version").Output()
		if err != nil {
			return fmt.Errorf("Go not found")
		}
		results = append(results, checkResult{"go", "pass", strings.TrimSpace(string(out))})
		return nil
	})

	if doctorMesh {
		g.Go(func() error {
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("no config: %w", err)
			}
			client := api.NewK4Client(cfg.K4CageURL)
			_, err = client.GetMesh()
			if err != nil {
				return fmt.Errorf("mesh strict failed: %w", err)
			}
			results = append(results, checkResult{"mesh:strict", "pass", cfg.K4CageURL})
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		results = append(results, checkResult{"doctor", "fail", err.Error()})
	}

	sortCheckResults(results)

	if !doctorJSON {
		printHumanResults(results)
	} else {
		printJSONResults(results)
	}

	if hasFailures(results) && !doctorJSON {
		return fmt.Errorf("doctor completed with failures")
	}

	if doctorVerify && !hasFailures(results) {
		fmt.Println()
		fmt.Println(colorize("36", "▶ p31 verify"))
		if err := runTransparentProxy("/home/p31/bonding-soup", "npm", "run", "verify"); err != nil {
			return err
		}
		results = append(results, checkResult{"verify", "pass", "npm run verify"})
	}

	if doctorFun && !hasFailures(results) {
		line := getJoyLine()
		if os.Getenv("NO_COLOR") != "" {
			fmt.Printf("\n◆ %s\n", line)
		} else {
			fmt.Printf("\n%s◆%s %s\n", ansi("35"), ansi("0"), line)
		}
	}

	if !hasFailures(results) && !doctorJSON {
		fmt.Println()
		fmt.Printf("%sNext%s  p31 connection  ·  p31 verify  ·  p31 release:all  ·  loose mesh: p31 release:local\n", colorize("36", ""), ansi("0"))
		fmt.Printf("        %sFamily handoff:%s p31ca.org/family-pack\n", ansi("2"), ansi("0"))
		fmt.Printf("        Manual: passkey Worker deploy, personal-tetra bundling, ECO hub merge\n")
	}

	return nil
}

func parseInt(s string) int {
	s = strings.TrimSpace(s)
	n := 0
	fmt.Sscanf(s, "%d", &n)
	return n
}

func getJoyLine() string {
	lines := []string{
		"local mesh · build · connect",
		"K₄ edges · zero-budget edge",
		"tetrahedron alive · all nodes green",
		"spoons sufficient · proceed",
		"passport verified · operator online",
		"mesh steady · 424 tests green",
		"paper XII DOI anchored",
		"cortex stack 5/5 healthy",
		"bonding soup warm · C.A.R.S. ready",
	}
	return lines[0]
}
