package cmd

import (
	"fmt"
	"os/exec"
	"runtime"

	"github.com/p31labs/p31-cli/internal/config"
	"github.com/spf13/cobra"
)

var surfaces = []string{"arcade", "vault", "hearth", "grid", "buffer", "archive", "node-zero"}

var surfaceListCmd = &cobra.Command{
	Use:   "list",
	Short: "List available surfaces",
	Run: func(cmd *cobra.Command, args []string) {
		for _, s := range surfaces {
			fmt.Println("-", s)
		}
	},
}

var surfaceLaunchCmd = &cobra.Command{
	Use:   "launch <surface>",
	Short: "Launch a surface in browser",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		surface := args[0]
		cfg, err := config.Load()
		if err != nil {
			return err
		}
		url := cfg.PhosURL + "/?surface=" + surface
		var errOpen error
		switch runtime.GOOS {
		case "linux":
			errOpen = exec.Command("xdg-open", url).Start()
		case "windows":
			errOpen = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
		case "darwin":
			errOpen = exec.Command("open", url).Start()
		default:
			errOpen = fmt.Errorf("unsupported platform")
		}
		if errOpen != nil {
			fmt.Printf("Open this URL manually: %s\n", url)
		} else {
			fmt.Printf("🌐 Launching %s surface at %s\n", surface, url)
		}
		return nil
	},
}

var surfaceCmd = &cobra.Command{
	Use:   "surface",
	Short: "Surface commands",
}

func init() {
	surfaceCmd.AddCommand(surfaceListCmd)
	surfaceCmd.AddCommand(surfaceLaunchCmd)
	rootCmd.AddCommand(surfaceCmd)
}
