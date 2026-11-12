// The preview module and its controls are eliminated from production builds.
if (
  import.meta.env.DEV &&
  new URLSearchParams(location.search).has("action-skill")
) {
  void import("./preview-action-skill");
} else if (
  import.meta.env.DEV &&
  new URLSearchParams(location.search).has("action-a")
) {
  void import("./preview-action-a");
} else {
  void import("./main");
}
