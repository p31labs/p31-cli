package cmd

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
)

var keyDir string

func init() {
	home, _ := os.UserHomeDir()
	keyDir = filepath.Join(home, ".p31", "keys")
	os.MkdirAll(keyDir, 0700)
}

var passportGenerateCmd = &cobra.Command{
	Use:   "generate",
	Short: "Generate Ed25519 keypair",
	RunE: func(cmd *cobra.Command, args []string) error {
		pub, priv, err := ed25519.GenerateKey(rand.Reader)
		if err != nil {
			return err
		}
		pubPath := filepath.Join(keyDir, "public.key")
		privPath := filepath.Join(keyDir, "private.key")
		if err := os.WriteFile(pubPath, pub, 0644); err != nil {
			return err
		}
		if err := os.WriteFile(privPath, priv, 0600); err != nil {
			return err
		}
		fmt.Println("✅ Keypair generated and saved to", keyDir)
		return nil
	},
}

var passportShowCmd = &cobra.Command{
	Use:   "show",
	Short: "Show public key and DID",
	RunE: func(cmd *cobra.Command, args []string) error {
		pubPath := filepath.Join(keyDir, "public.key")
		pub, err := os.ReadFile(pubPath)
		if err != nil {
			return fmt.Errorf("no keypair found, run `p31 passport generate` first")
		}
		fmt.Println("Public key (base64):", base64.StdEncoding.EncodeToString(pub))
		fmt.Println("Fingerprint:", hex.EncodeToString(pub[:8]))
		return nil
	},
}

var passportExportCmd = &cobra.Command{
	Use:   "export",
	Short: "Export portable token (P31‑CPv2)",
	RunE: func(cmd *cobra.Command, args []string) error {
		pubPath := filepath.Join(keyDir, "public.key")
		privPath := filepath.Join(keyDir, "private.key")
		pub, err := os.ReadFile(pubPath)
		if err != nil {
			return fmt.Errorf("no keypair found")
		}
		priv, err := os.ReadFile(privPath)
		if err != nil {
			return err
		}
		token := base64.StdEncoding.EncodeToString(append(pub, priv...))
		fmt.Println("P31-CPv2:" + token)
		return nil
	},
}

var passportCmd = &cobra.Command{
	Use:   "passport",
	Short: "Cognitive Passport commands",
}

func init() {
	passportCmd.AddCommand(passportGenerateCmd)
	passportCmd.AddCommand(passportShowCmd)
	passportCmd.AddCommand(passportExportCmd)
	rootCmd.AddCommand(passportCmd)
}
