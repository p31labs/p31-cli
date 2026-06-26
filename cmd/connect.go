package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var connectCmd = &cobra.Command{
	Use:   "connect",
	Short: "Show CONNECTION spine",
	RunE: func(cmd *cobra.Command, args []string) error {
		fmt.Println("CONNECTION SPINE")
		fmt.Println("================")

		fmt.Printf("%-20s %s\n", "PHOS Core", "https://phos.p31ca.org")
		fmt.Printf("%-20s %s\n", "K4 Cage", "https://k4-cage.trimtab-signal.workers.dev")
		fmt.Printf("%-20s %s\n", "GPG Key", "pub   ed25519 2026-05-08 [SC]")
		fmt.Printf("%-20s %s\n", "", "2448 5257 A214 9AFA")
		fmt.Printf("%-20s %s\n", "Mesh TUI", "p31 doctor --mesh")

		return nil
	},
}

func init() {
	rootCmd.AddCommand(connectCmd)
}
