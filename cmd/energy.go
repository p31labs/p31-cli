package cmd

import (
    "fmt"
    "log"

    "github.com/p31labs/p31-cli/internal/api"
    "github.com/p31labs/p31-cli/internal/config"
    "github.com/spf13/cobra"
)

var energyCmd = &cobra.Command{
    Use:   "energy",
    Short: "Query current energy level (via Ollama or mock)",
    RunE: func(cmd *cobra.Command, args []string) error {
        cfg, err := config.Load()
        if err != nil {
            return err
        }
        ollama := api.NewOllamaClient(cfg.OllamaURL, cfg.DefaultModel)
        resp, err := ollama.Chat("On a scale of 0-10, how much energy do you have? Answer only a number.")
        if err != nil {
            log.Println("Ollama not available, using mock energy")
            fmt.Println("💡 Energy level: 6/10 (mock)")
            return nil
        }
        fmt.Printf("💡 Energy level: %s/10 (AI estimate)\n", resp)
        return nil
    },
}

func init() {
    rootCmd.AddCommand(energyCmd)
}