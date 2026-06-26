package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var (
	cfgFile   string
	verbose   bool
	rootCmd = &cobra.Command{
		Use:   "p31",
		Short: "P31 Labs CLI – mesh, surfaces, passport, LLM chat",
		Long:  `P31 CLI – control your K4 Cage, launch surfaces, manage Cognitive Passport, and chat with local AI.`,
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			if verbose {
				fmt.Fprintln(os.Stderr, "🔧 Verbose mode enabled")
			}
			return checkRateLimit()
		},
	}
)

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	cobra.OnInitialize(initConfig)
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is $HOME/.p31/config.yaml)")
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "verbose output")
}

func initConfig() {
	if cfgFile != "" {
		viper.SetConfigFile(cfgFile)
	} else {
		home, err := os.UserHomeDir()
		if err != nil {
			fmt.Fprintln(os.Stderr, "Error getting home dir:", err)
			os.Exit(1)
		}
		viper.AddConfigPath(filepath.Join(home, ".p31"))
		viper.SetConfigType("yaml")
		viper.SetConfigName("config")
	}
	viper.AutomaticEnv()
	if err := viper.ReadInConfig(); err == nil && verbose {
		fmt.Fprintln(os.Stderr, "Using config file:", viper.ConfigFileUsed())
	}
}
