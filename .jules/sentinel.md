## 2024-05-24 - [Fix] Cross-Site Scripting (XSS) in Breach Details Modal
**Vulnerability:** XSS vulnerability in Breach Details modal due to unescaped rendering of HTML from external API.
**Learning:** External API data should be treated as untrusted and properly sanitized before rendering as HTML.
**Prevention:** Always use a sanitation library like DOMPurify when setting HTML using `dangerouslySetInnerHTML`.
