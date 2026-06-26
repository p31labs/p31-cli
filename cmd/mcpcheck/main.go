package main

import (
	"context"
	"fmt"
	"time"

	mcpclient "github.com/mark3labs/mcp-go/client"
	mcptypes "github.com/mark3labs/mcp-go/mcp"
)

func main() {
	servers := []struct {
		name    string
		command string
		args    []string
		env     []string
	}{
		{
			name:    "phos-forge",
			command: "node",
			args:    []string{"/home/p31/P31-local-workspace/tools/phos-forge/mcp-server.mjs"},
		},
	}

	for _, s := range servers {
		fmt.Printf("Testing %s...\n", s.name)

		c, err := mcpclient.NewStdioMCPClient(s.command, s.env, s.args...)
		if err != nil {
			fmt.Printf("  FAIL connect: %v\n", err)
			continue
		}
		fmt.Println("  Stdio client created")

		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		initReq := mcptypes.InitializeRequest{}
		initReq.Params.ProtocolVersion = mcptypes.LATEST_PROTOCOL_VERSION
		initReq.Params.ClientInfo = mcptypes.Implementation{Name: "test", Version: "1.0"}
		initResult, err := c.Initialize(ctx, initReq)
		cancel()
		if err != nil {
			fmt.Printf("  FAIL init: %v\n", err)
			c.Close()
			continue
		}
		fmt.Printf("  Connected: %s v%s\n", initResult.ServerInfo.Name, initResult.ServerInfo.Version)

		ctx2, cancel2 := context.WithTimeout(context.Background(), 10*time.Second)
		tools, err := c.ListTools(ctx2, mcptypes.ListToolsRequest{})
		cancel2()
		if err != nil {
			fmt.Printf("  FAIL list tools: %v\n", err)
			c.Close()
			continue
		}
		fmt.Printf("  Tools: %d\n", len(tools.Tools))
		for _, t := range tools.Tools {
			fmt.Printf("    - %s: %s\n", t.Name, t.Description)
		}
		c.Close()
		fmt.Println("  PASS")
	}
}
