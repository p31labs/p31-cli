package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/p31labs/p31-cli/internal/api"
	"github.com/spf13/cobra"
)

var quantumToken string
var quantumBaseURL string

func init() {
	quantumCmd.PersistentFlags().StringVar(&quantumToken, "token", "", "Quantum/Kilo JWT token (overrides env KILO_JWT_TOKEN)")
	quantumCmd.PersistentFlags().StringVar(&quantumBaseURL, "base-url", "", "Quantum gateway base URL (overrides env QUANTUM_BASE_URL)")
	rootCmd.AddCommand(quantumCmd)
}

var quantumCmd = &cobra.Command{
	Use:   "quantum",
	Short: "Interact with the P31 Quantum Gateway (via Kilo)",
}

var quantumSubmitCmd = &cobra.Command{
	Use:   "submit [qasm_file]",
	Short: "Submit a QASM circuit to the quantum bridge",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		token := quantumToken
		if token == "" {
			token = os.Getenv("KILO_JWT_TOKEN")
		}
		if token == "" {
			return fmt.Errorf("no Quantum/Kilo token provided; set KILO_JWT_TOKEN env or use --token")
		}
		baseURL := quantumBaseURL
		if baseURL == "" {
			baseURL = os.Getenv("QUANTUM_BASE_URL")
		}
		if baseURL == "" {
			baseURL = api.QuantumDefaultBaseURL
		}

		data, err := os.ReadFile(args[0])
		if err != nil {
			return fmt.Errorf("read qasm file: %w", err)
		}

		backend, _ := cmd.Flags().GetString("backend")
		shots, _ := cmd.Flags().GetInt("shots")

		client := api.NewQuantumClient(api.QuantumConfig{
			BaseURL: baseURL,
			Token:   token,
		})
		res, err := client.SubmitCircuit(string(data), backend, shots)
		if err != nil {
			return err
		}
		fmt.Printf("Job ID: %s\nStatus: %s\n", res.JobID, res.Status)
		return nil
	},
}

var quantumResultCmd = &cobra.Command{
	Use:   "result <jobId>",
	Short: "Retrieve results for a submitted quantum job",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		token := quantumToken
		if token == "" {
			token = os.Getenv("KILO_JWT_TOKEN")
		}
		if token == "" {
			return fmt.Errorf("no Quantum/Kilo token provided; set KILO_JWT_TOKEN env or use --token")
		}
		baseURL := quantumBaseURL
		if baseURL == "" {
			baseURL = os.Getenv("QUANTUM_BASE_URL")
		}
		if baseURL == "" {
			baseURL = api.QuantumDefaultBaseURL
		}

		client := api.NewQuantumClient(api.QuantumConfig{
			BaseURL: baseURL,
			Token:   token,
		})
		res, err := client.GetResult(args[0])
		if err != nil {
			return err
		}
		fmt.Printf("Job ID:  %s\nStatus:  %s\n", res.JobID, res.Status)
		if res.Error != "" {
			fmt.Printf("Error:   %s\n", res.Error)
			return nil
		}
		if len(res.Results) != 0 {
			b, err := json.Marshal(res.Results)
			if err != nil {
				return err
			}
			fmt.Printf("Results: %s\n", string(b))
		}
		return nil
	},
}

func init() {
	addQuantumFlags(quantumSubmitCmd)
	quantumCmd.AddCommand(quantumSubmitCmd)
	quantumCmd.AddCommand(quantumResultCmd)
}

func addQuantumFlags(cmd *cobra.Command) {
	cmd.Flags().StringP("backend", "b", "", "QPU backend to target (default: simulator)")
	cmd.Flags().IntP("shots", "s", 1024, "Measurement shots per execution")
}
