package cmd

import (
    "encoding/json"
    "fmt"
    "net/http"
    "os"
    "strings"
    "time"

    "github.com/p31labs/p31-cli/internal/config"
    "github.com/spf13/cobra"
)

var logsTailCmd = &cobra.Command{
    Use:   "tail",
    Short: "Tail logs from command-center",
    RunE: func(cmd *cobra.Command, args []string) error {
        cfg, err := config.Load()
        if err != nil {
            return err
        }
        url := strings.Replace(cfg.K4CageURL, "k4-cage", "command-center", 1)
        url += "/api/status"
        fmt.Println("📜 Streaming logs (Ctrl+C to stop)...")
        ticker := time.NewTicker(2 * time.Second)
        defer ticker.Stop()
        for range ticker.C {
            resp, err := http.Get(url)
            if err != nil {
                fmt.Fprintf(os.Stderr, "Error fetching logs: %v\n", err)
                continue
            }
            var result map[string]interface{}
            if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
                for k, v := range result {
                    fmt.Printf("[%s] %s: %v\n", time.Now().Format("15:04:05"), k, v)
                }
            }
            resp.Body.Close()
        }
        return nil
    },
}

var logsCmd = &cobra.Command{
    Use:   "logs",
    Short: "Logs commands",
}

func init() {
    logsCmd.AddCommand(logsTailCmd)
    rootCmd.AddCommand(logsCmd)
}
