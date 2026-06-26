package cmd

import (
	"fmt"
	"os"
	"sort"
)

func ansi(code string) string {
	return "\033[" + code + "m"
}

func colorize(code, text string) string {
	return ansi(code) + text + ansi("0")
}

func dim(s string) string {
	return ansi("2") + s + ansi("0")
}

func green(s string) string {
	return ansi("32") + s + ansi("0")
}

func printf(format string, args ...interface{}) {
	fmt.Printf(format, args...)
}

func sortCheckResults(results []checkResult) {
	sort.Slice(results, func(i, j int) bool {
		return results[i].Name < results[j].Name
	})
}

func printHumanResults(results []checkResult) {
	for _, r := range results {
		switch r.Status {
		case "pass":
			printf("%s✓%s %-18s %s\n", ansi("32"), ansi("0"), r.Name, r.Msg)
		case "warn":
			printf("%s⚠%s %-18s %s\n", ansi("33"), ansi("0"), r.Name, r.Msg)
		case "fail":
			fmt.Fprintf(os.Stderr, "%s✗%s %-18s %s\n", ansi("31"), ansi("0"), r.Name, r.Msg)
		}
	}
}

func printJSONResults(results []checkResult) {
	for _, r := range results {
		fmt.Printf("%s %s %s\n", r.Name, r.Status, r.Msg)
	}
}

func hasFailures(results []checkResult) bool {
	for _, r := range results {
		if r.Status == "fail" {
			return true
		}
	}
	return false
}
