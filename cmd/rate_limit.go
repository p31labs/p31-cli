package cmd

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

var rateLimitEnabled bool

func init() {
	rootCmd.PersistentFlags().BoolVar(&rateLimitEnabled, "rate-limit", true, "enable somatic rate limiting (30 commands/15 min)")
}

func checkRateLimit() error {
	if !rateLimitEnabled {
		return nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	dbPath := filepath.Join(home, ".p31", "telemetry.db")
	os.MkdirAll(filepath.Dir(dbPath), 0755)

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return err
	}
	defer db.Close()

	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS commands (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		timestamp INTEGER NOT NULL,
		command TEXT NOT NULL
	)`)
	if err != nil {
		return err
	}

	now := time.Now().Unix()
	fifteenMinsAgo := now - 15*60

	var count int
	err = db.QueryRow(`SELECT COUNT(*) FROM commands WHERE timestamp > ?`, fifteenMinsAgo).Scan(&count)
	if err != nil {
		return err
	}

	if count >= 30 {
		fmt.Fprintln(os.Stderr, colorize("33", "⚠️ 30+ commands in 15 minutes – somatic check recommended"))
		fmt.Print("\a")
	}

	// Join args with spaces to store as single string
	cmdString := strings.Join(os.Args, " ")
	_, err = db.Exec(`INSERT INTO commands (timestamp, command) VALUES (?, ?)`, now, cmdString)
	return err
}
