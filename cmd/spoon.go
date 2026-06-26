package cmd

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/p31labs/p31-cli/internal/config"
	"github.com/spf13/cobra"
)

type SpoonStatus struct {
	Spoons int `json:"spoons"`
}

var spoonCmd = &cobra.Command{
	Use:   "spoon",
	Short: "Show current spoon level (read-only; from local Spoon Monitor or PHOS Core)",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return err
		}

		spoons, src, err := fetchSpoons(cfg)
		if err != nil || spoons < 0 {
			fmt.Println("🥄 Spoon level: 5/10 (default – no local service reached)")
			return nil
		}

		fmt.Printf("🥄 Spoon level: %d/10 (via %s)\n", spoons, src)
		if spoons <= 2 {
			fmt.Println("⚠️ Low spoons – consider resting.")
		}
		return nil
	},
}

func fetchSpoons(cfg *config.Config) (int, string, error) {
	localURL := "http://127.0.0.1:5002/api/state"
	resp, err := http.Get(localURL)
	if err == nil && resp.StatusCode == 200 {
		defer resp.Body.Close()
		var data map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&data); err == nil {
			if s, ok := data["spoons"].(float64); ok {
				return int(s), "Spoon Monitor (:5002)", nil
			}
		}
	}

	url := cfg.PhosURL + "/api/spoons"
	resp, err = http.Get(url)
	if err != nil || resp.StatusCode != 200 {
		return -1, "", fmt.Errorf("no spoon source reachable")
	}
	defer resp.Body.Close()
	var status SpoonStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return -1, "", err
	}
	return status.Spoons, "PHOS Core (" + cfg.PhosURL + ")", nil
}

func init() {
	rootCmd.AddCommand(spoonCmd)
}
