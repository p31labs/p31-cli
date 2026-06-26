package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	QuantumDefaultBaseURL = "https://p31-forge.trimtab-signal.workers.dev"
)

type QuantumConfig struct {
	BaseURL    string
	Token      string
	HTTPClient *http.Client
}

type QuantumSubmitRequest struct {
	QASM    string `json:"qasm"`
	Backend string `json:"backend,omitempty"`
	Shots   int    `json:"shots,omitempty"`
}

type QuantumSubmitResponse struct {
	Status string `json:"status"`
	JobID  string `json:"jobId"`
}

type QuantumResultResponse struct {
	JobID   string                 `json:"jobId"`
	Status  string                 `json:"status"`
	Results map[string]interface{} `json:"results,omitempty"`
	Error   string                 `json:"error,omitempty"`
}

type QuantumClient struct {
	config QuantumConfig
}

func NewQuantumClient(cfg QuantumConfig) *QuantumClient {
	if cfg.BaseURL == "" {
		cfg.BaseURL = QuantumDefaultBaseURL
	}
	if cfg.HTTPClient == nil {
		cfg.HTTPClient = &http.Client{Timeout: 60 * time.Second}
	}
	return &QuantumClient{config: cfg}
}

func (c *QuantumClient) doRequest(method, path string, body interface{}) ([]byte, error) {
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
	if c.config.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.config.Token)
	}
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
		return nil, fmt.Errorf("quantum API error %d: %s", resp.StatusCode, string(data))
	}
	return data, nil
}

func (c *QuantumClient) SubmitCircuit(qasm string, backend string, shots int) (*QuantumSubmitResponse, error) {
	reqBody := QuantumSubmitRequest{QASM: qasm, Backend: backend, Shots: shots}
	data, err := c.doRequest("POST", "/quantum/seeds", reqBody)
	if err != nil {
		return nil, err
	}
	var res QuantumSubmitResponse
	if err := json.Unmarshal(data, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *QuantumClient) GetResult(jobID string) (*QuantumResultResponse, error) {
	data, err := c.doRequest("GET", "/quantum/result/"+jobID, nil)
	if err != nil {
		return nil, err
	}
	var res QuantumResultResponse
	if err := json.Unmarshal(data, &res); err != nil {
		return nil, err
	}
	return &res, nil
}
