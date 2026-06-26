package config

import (
    "os"
    "path/filepath"

    "github.com/spf13/viper"
)

func Load() (*Config, error) {
    home, err := os.UserHomeDir()
    if err != nil {
        return nil, err
    }
    configDir := filepath.Join(home, ".p31")
    if err := os.MkdirAll(configDir, 0755); err != nil {
        return nil, err
    }
    viper.SetConfigType("yaml")
    viper.SetConfigName("config")
    viper.AddConfigPath(configDir)
    viper.SetDefault("k4_cage_url", "https://k4-cage.trimtab-signal.workers.dev")
    viper.SetDefault("phos_url", "https://phos.p31ca.org")
	viper.SetDefault("ollama_url", "http://127.0.0.1:11434")
	viper.SetDefault("default_model", "qwen2.5:1.5b")
	viper.SetDefault("proxy_url", "http://localhost:4001/v1")
	viper.SetDefault("proxy_model", "flash")

    if err := viper.ReadInConfig(); err != nil {
        if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
            return nil, err
        }
    }
    var cfg Config
    if err := viper.Unmarshal(&cfg); err != nil {
        return nil, err
    }
    return &cfg, nil
}

type Config struct {
	K4CageURL    string `mapstructure:"k4_cage_url"`
	PhosURL      string `mapstructure:"phos_url"`
	OllamaURL    string `mapstructure:"ollama_url"`
	DefaultModel string `mapstructure:"default_model"`
	ProxyURL     string `mapstructure:"proxy_url"`
	ProxyModel   string `mapstructure:"proxy_model"`
}
