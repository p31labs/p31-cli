package api

import (
    "encoding/json"
    "fmt"
    "net/http"
)

type K4Client struct {
    BaseURL string
    Client  *http.Client
}

type MeshNode struct {
    ID     string `json:"id"`
    Name   string `json:"name"`
    Love   int    `json:"love"`
    Status string `json:"status"`
}

type MeshResponse struct {
    Topology string              `json:"topology"`
    Vertices int                 `json:"vertices"`
    Edges    int                 `json:"edges"`
    Mesh     struct {
        Vertices map[string]MeshNode `json:"vertices"`
    } `json:"mesh"`
    TotalLove int `json:"totalLove"`
}

func NewK4Client(baseURL string) *K4Client {
    return &K4Client{
        BaseURL: baseURL,
        Client:  &http.Client{},
    }
}

func (c *K4Client) GetMesh() (*MeshResponse, error) {
    resp, err := c.Client.Get(c.BaseURL + "/api/mesh")
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("unexpected status: %s", resp.Status)
    }
    var mesh MeshResponse
    if err := json.NewDecoder(resp.Body).Decode(&mesh); err != nil {
        return nil, err
    }
    return &mesh, nil
}
