// The preview module and its controls are eliminated from production builds.
if (
  import.meta.env.DEV &&
  new URLSearchParams(location.search).has("action-a")
) {
  void import("./action-a/preview");
} else {
  void import("./main");
}
