package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"text/tabwriter"
	"time"

	"github.com/gorilla/websocket"
	"github.com/p31labs/p31-cli/internal/api"
	"github.com/p31labs/p31-cli/internal/config"
	"github.com/spf13/cobra"
)

var meshStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show K4 Cage mesh status",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return err
		}
		client := api.NewK4Client(cfg.K4CageURL)
		mesh, err := client.GetMesh()
		if err != nil {
			return err
		}
		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "NODE\tLOVE\tSTATUS")
		for _, node := range mesh.Mesh.Vertices {
			fmt.Fprintf(w, "%s\t%d\t%s\n", node.Name, node.Love, node.Status)
		}
		w.Flush()
		fmt.Printf("\n🔗 Total love: %d\n", mesh.TotalLove)
		return nil
	},
}

var meshWatchCmd = &cobra.Command{
	Use:   "watch",
	Short: "Watch real-time mesh events (WebSocket)",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return err
		}
		wsURL := cfg.K4CageURL
		if wsURL[:5] == "https" {
			wsURL = "wss" + wsURL[5:]
		} else if wsURL[:4] == "http" {
			wsURL = "ws" + wsURL[4:]
		}
		wsURL += "/ws/family-mesh?node=p31-cli"
		c, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		if err != nil {
			return err
		}
		defer c.Close()
		ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
		defer stop()
		fmt.Println("🕸️  Listening to mesh events... (Ctrl+C to stop)")
		go func() {
			<-ctx.Done()
			c.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
		}()
		for {
			_, msg, err := c.ReadMessage()
			if err != nil {
				return err
			}
			var event map[string]interface{}
			if err := json.Unmarshal(msg, &event); err == nil {
				ts, _ := event["ts"].(float64)
				t := time.Unix(int64(ts)/1000, 0).Format("15:04:05")
				switch event["type"] {
				case "joined":
					fmt.Printf("[%s] ✅ %s joined\n", t, event["node"])
				case "user_left":
					fmt.Printf("[%s] ❌ %s left\n", t, event["node"])
				case "ping":
					fmt.Printf("[%s] 💚 %s sent %s\n", t, event["sender"], event["emoji"])
				default:
					fmt.Printf("[%s] 📨 %v\n", t, event)
				}
			} else {
				fmt.Printf("📨 %s\n", msg)
			}
		}
	},
}

var meshCmd = &cobra.Command{
	Use:   "mesh",
	Short: "Mesh commands",
}

func init() {
	meshCmd.AddCommand(meshStatusCmd)
	meshCmd.AddCommand(meshWatchCmd)
	rootCmd.AddCommand(meshCmd)
}
