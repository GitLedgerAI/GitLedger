# Security Policy

## Supported versions
This project is pre-1.0 and actively developed. Security fixes are applied on `main`.

## Reporting a vulnerability
- Do not open public issues for vulnerabilities.
- Email: `security@gitledger.tech`.
- Include:
  - vulnerability type and impact
  - affected components (`backend`, `contract`, `frontend`)
  - reproduction steps / PoC
  - suggested mitigation (optional)

## Response targets
- Initial acknowledgment: within 72 hours
- Triage decision: within 7 days
- Remediation target: based on severity

## Severity guidance
- Critical: key compromise, auth bypass, loss of funds
- High: remote exploit, unauthorized write/action
- Medium: data exposure with constraints
- Low: hard-to-exploit issues with limited impact

## Hard requirements
- Rotate compromised keys immediately.
- Revoke leaked credentials and invalidate sessions.
- Patch and backfill tests before public disclosure.
