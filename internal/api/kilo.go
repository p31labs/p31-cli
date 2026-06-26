package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

const (
	KiloDefaultBaseURL = "https://kilo.ai/api"
)

type KiloConfig struct {
	BaseURL    string
	JWTToken   string
	HTTPClient *http.Client
}

type KiloUserProfile struct {
	User struct {
		ID    string `json:"id"`
		Email string `json:"email"`
		Name  string `json:"name"`
		Image string `json:"image"`
	} `json:"user"`
}

type KiloUserDetail struct {
	ID                       string `json:"id"`
	GoogleUserEmail          string `json:"google_user_email"`
	GoogleUserName           string `json:"google_user_name"`
	MicrodollarsUsed         int    `json:"microdollars_used"`
	TotalMicrodollarsAcquired int   `json:"total_microdollars_acquired"`
	IsAdmin                  bool   `json:"is_admin"`
	DefaultModel             *string `json:"default_model"`
	CustomerSource           string `json:"customer_source"`
}

type KiloModel struct {
	ID              string                 `json:"id"`
	Name            string                 `json:"name"`
	Description     string                 `json:"description"`
	PriceInput      string                 `json:"priceInput"`
	PriceOutput     string                 `json:"priceOutput"`
	ContextLength   int                    `json:"contextLength"`
	MaxOutputTokens int                    `json:"maxOutputTokens"`
	CodingIndex     *float64               `json:"codingIndex"`
	SpeedTokensPerSec *float64             `json:"speedTokensPerSec"`
	InputModalities []string               `json:"inputModalities"`
	ChartData       map[string]interface{} `json:"chartData"`
}

type KiloModelsResponse []KiloModel

type KiloClient struct {
	config KiloConfig
}

func NewKiloClient(cfg KiloConfig) *KiloClient {
	if cfg.BaseURL == "" {
		cfg.BaseURL = KiloDefaultBaseURL
	}
	if cfg.HTTPClient == nil {
		cfg.HTTPClient = &http.Client{Timeout: 30 * time.Second}
	}
	if cfg.JWTToken == "" {
		cfg.JWTToken = os.Getenv("KILO_JWT_TOKEN")
	}
	return &KiloClient{config: cfg}
}

func (c *KiloClient) doRequest(method, path string, body interface{}) ([]byte, error) {
	url := c.config.BaseURL + path
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reqBody = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.config.JWTToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.config.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("kilo API error %d: %s", resp.StatusCode, string(data))
	}
	return data, nil
}

func (c *KiloClient) GetProfile() (*KiloUserProfile, error) {
	data, err := c.doRequest("GET", "/profile", nil)
	if err != nil {
		return nil, err
	}
	var profile KiloUserProfile
	if err := json.Unmarshal(data, &profile); err != nil {
		return nil, err
	}
	return &profile, nil
}

func (c *KiloClient) GetUser() (*KiloUserDetail, error) {
	data, err := c.doRequest("GET", "/user", nil)
	if err != nil {
		return nil, err
	}
	var user KiloUserDetail
	if err := json.Unmarshal(data, &user); err != nil {
		return nil, err
	}
	return &user, nil
}

func (c *KiloClient) GetModels() (KiloModelsResponse, error) {
	data, err := c.doRequest("GET", "/models", nil)
	if err != nil {
		return nil, err
	}
	var models KiloModelsResponse
	if err := json.Unmarshal(data, &models); err != nil {
		return nil, err
	}
	return models, nil
}
