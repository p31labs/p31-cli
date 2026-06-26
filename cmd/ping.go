package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/p31labs/p31-cli/internal/config"
	"github.com/spf13/cobra"
)

var pingCmd = &cobra.Command{
	Use:   "ping <to> <emoji>",
	Short: "Send a ping to a family member",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		to := args[0]
		emoji := args[1]
		cfg, err := config.Load()
		if err != nil {
			return err
		}
		from := "will"
		url := cfg.K4CageURL + "/api/ping/" + from + "/" + to
		body, _ := json.Marshal(map[string]string{"emoji": emoji})
		resp, err := http.Post(url, "application/json", bytes.NewReader(body))
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("ping failed: %s", resp.Status)
		}
		fmt.Printf("💚 Ping sent from %s to %s with %s\n", from, to, emoji)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(pingCmd)
}
