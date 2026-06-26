package cmd

import (
	"os"
	"os/exec"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"
)

func runTransparentProxy(dir string, name string, args ...string) error {
	execCmd := exec.Command(name, args...)
	execCmd.Dir = dir

	execCmd.Stdout = os.Stdout
	execCmd.Stderr = os.Stderr
	execCmd.Stdin = os.Stdin
	execCmd.Env = os.Environ()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM, syscall.SIGQUIT)
	go func() {
		for sig := range sigChan {
			if execCmd.Process != nil {
				execCmd.Process.Signal(sig)
			}
		}
	}()

	err := execCmd.Run()

	signal.Stop(sigChan)
	close(sigChan)
	return err
}

var cashpilotCmd = &cobra.Command{
	Use:                "cashpilot [command]",
	Short:              "DePIN earnings optimizer & Docker stack",
	DisableFlagParsing: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		return runTransparentProxy("/home/p31/cashpilot", "./deploy.sh", args...)
	},
}

var forgeCmd = &cobra.Command{
	Use:                "forge [command]",
	Short:              "Document generation (court, grant, paper)",
	DisableFlagParsing: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		nodeArgs := append([]string{"andromeda/software/p31-forge/forge.js"}, args...)
		return runTransparentProxy("/home/p31", "node", nodeArgs...)
	},
}


var launchCmd = &cobra.Command{
	Use:                "launch [command]",
	Short:              "Market launch pipeline",
	DisableFlagParsing: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		npmArgs := append([]string{"run", "launch"}, args...)
		return runTransparentProxy("/home/p31/bonding-soup", "npm", npmArgs...)
	},
}

var ciCmd = &cobra.Command{
	Use:                "ci [args]",
	Short:              "Run CI equivalent locally",
	DisableFlagParsing: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		npmArgs := append([]string{"run", "p31:ci"}, args...)
		return runTransparentProxy("/home/p31/bonding-soup", "npm", npmArgs...)
	},
}

var triperCmd = &cobra.Command{
	Use:                "triper [command]",
	Short:              "TRIPER MVP certification system",
	DisableFlagParsing: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		npmArgs := append([]string{"run", "p31", "--", "triper"}, args...)
		return runTransparentProxy("/home/p31/bonding-soup", "npm", npmArgs...)
	},
}

var hubDiffCmd = &cobra.Command{
	Use:   "hub-diff",
	Short: "Diff p31ca hub against ground truth",
	RunE: func(cmd *cobra.Command, args []string) error {
		return runTransparentProxy("/home/p31/bonding-soup", "npm", "run", "hub:diff:p31ca")
	},
}

var commandCenterCmd = &cobra.Command{
	Use:                "command-center [args]",
	Short:              "Start local operator UI (:3131)",
	DisableFlagParsing: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		npmArgs := append([]string{"run", "command-center"}, args...)
		return runTransparentProxy("/home/p31/bonding-soup", "npm", npmArgs...)
	},
}

var openCmd = &cobra.Command{
	Use:                "open [target]",
	Short:              "Open local dev surfaces in browser",
	DisableFlagParsing: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		npmArgs := append([]string{"run", "p31", "--", "open"}, args...)
		return runTransparentProxy("/home/p31/bonding-soup", "npm", npmArgs...)
	},
}

func init() {
	rootCmd.AddCommand(cashpilotCmd)
	rootCmd.AddCommand(forgeCmd)
	rootCmd.AddCommand(launchCmd)
	rootCmd.AddCommand(ciCmd)
	rootCmd.AddCommand(triperCmd)
	rootCmd.AddCommand(hubDiffCmd)
	rootCmd.AddCommand(commandCenterCmd)
	rootCmd.AddCommand(openCmd)
}
