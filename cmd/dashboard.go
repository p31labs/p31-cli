package cmd

import (
    "github.com/p31labs/p31-cli/internal/tui"
    "github.com/spf13/cobra"
)

var dashboardCmd = &cobra.Command{
    Use:   "dashboard",
    Short: "Start TUI dashboard",
    RunE: func(cmd *cobra.Command, args []string) error {
        return tui.RunDashboard()
    },
}

func init() {
    rootCmd.AddCommand(dashboardCmd)
}
