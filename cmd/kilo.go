package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/p31labs/p31-cli/internal/api"
	"github.com/spf13/cobra"
)

var kiloToken string

func init() {
	kiloCmd.PersistentFlags().StringVar(&kiloToken, "token", "", "Kilo JWT token (overrides env KILO_JWT_TOKEN)")
	rootCmd.AddCommand(kiloCmd)
}

var kiloCmd = &cobra.Command{
	Use:   "kilo",
	Short: "Interact with Kilo Gateway",
}

var kiloProfileCmd = &cobra.Command{
	Use:   "profile",
	Short: "Show your Kilo user profile",
	RunE: func(cmd *cobra.Command, args []string) error {
		token := kiloToken
		if token == "" {
			token = os.Getenv("KILO_JWT_TOKEN")
		}
		if token == "" {
			return fmt.Errorf("no Kilo token provided; set KILO_JWT_TOKEN env or use --token")
		}
		client := api.NewKiloClient(api.KiloConfig{JWTToken: token})
		profile, err := client.GetProfile()
		if err != nil {
			return err
		}
		fmt.Printf("ID:    %s\n", profile.User.ID)
		fmt.Printf("Email: %s\n", profile.User.Email)
		fmt.Printf("Name:  %s\n", profile.User.Name)
		fmt.Printf("Image: %s\n", profile.User.Image)
		return nil
	},
}

var kiloUserCmd = &cobra.Command{
	Use:   "user",
	Short: "Show detailed user information",
	RunE: func(cmd *cobra.Command, args []string) error {
		token := kiloToken
		if token == "" {
			token = os.Getenv("KILO_JWT_TOKEN")
		}
		if token == "" {
			return fmt.Errorf("no Kilo token provided; set KILO_JWT_TOKEN env or use --token")
		}
		client := api.NewKiloClient(api.KiloConfig{JWTToken: token})
		user, err := client.GetUser()
		if err != nil {
			return err
		}
		fmt.Printf("ID:                  %s\n", user.ID)
		fmt.Printf("Email:               %s\n", user.GoogleUserEmail)
		fmt.Printf("Name:                %s\n", user.GoogleUserName)
		fmt.Printf("Customer source:     %s\n", user.CustomerSource)
		fmt.Printf("Microdollars used:   %d\n", user.MicrodollarsUsed)
		fmt.Printf("Total acquired:      %d\n", user.TotalMicrodollarsAcquired)
		fmt.Printf("Admin:               %t\n", user.IsAdmin)
		if user.DefaultModel != nil && *user.DefaultModel != "" {
			fmt.Printf("Default model:       %s\n", *user.DefaultModel)
		}
		return nil
	},
}

var kiloModelsCmd = &cobra.Command{
	Use:   "models",
	Short: "List available models from Kilo catalog",
	RunE: func(cmd *cobra.Command, args []string) error {
		token := kiloToken
		if token == "" {
			token = os.Getenv("KILO_JWT_TOKEN")
		}
		if token == "" {
			return fmt.Errorf("no Kilo token provided; set KILO_JWT_TOKEN env or use --token")
		}
		client := api.NewKiloClient(api.KiloConfig{JWTToken: token})
		models, err := client.GetModels()
		if err != nil {
			return err
		}
		fmt.Printf("%-36s %12s %12s %10s %s\n", "Name", "Input Cost", "Output Cost", "Context", "Modalities")
		for _, m := range models {
			costIn := m.PriceInput
			costOut := m.PriceOutput
			ctx := fmt.Sprintf("%dk", m.ContextLength/1000)
			mods := fmt.Sprintf("%v", m.InputModalities)
			fmt.Printf("%-36s %12s %12s %10s %s\n", truncate(m.Name, 36), costIn, costOut, ctx, mods)
		}
		return nil
	},
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	if max <= 3 {
		return strings.Repeat(".", max)
	}
	return s[:max-3] + "..."
}

func init() {
	kiloCmd.AddCommand(kiloProfileCmd)
	kiloCmd.AddCommand(kiloUserCmd)
	kiloCmd.AddCommand(kiloModelsCmd)
}
