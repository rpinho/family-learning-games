# Security and hosting boundary

These prototypes are intended for one computer or a trusted private home network. They default to loopback listening and use local files for saves. They are **not a multi-tenant service** and must not be exposed to the internet as-is.

The code includes bounded inputs, same-origin/host checks, revision checks and restricted static routes. Those protections do not replace authentication, authorization, TLS, rate limiting, security review or a data-retention policy. The visible Admin option and arithmetic parent gate are not security controls against a determined person.

Do not add a public tunnel, port forwarding or public reverse proxy without implementing and reviewing those missing protections. Do not place secret keys in browser code. This collection needs no AI API key to run.

Report a security issue privately to the repository owner through GitHub's available private reporting/contact features. Never include a real child's data in a public issue or pull request.
