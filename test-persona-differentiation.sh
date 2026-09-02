#!/usr/bin/env bash
# ============================================================
# PERSONA DIFFERENTIATION TEST
#
# Round 2 requirement #9: prove Executive != Analyst != Operations
# for the SAME investigation, not just "the code exists." Run this
# against a live server (npm start in server/) any time you want to
# re-verify persona genuinely drives the engine, not just the UI.
#
# Usage: bash test-persona-differentiation.sh [base_url]
#   base_url defaults to http://localhost:4000
# ============================================================
set -e
BASE="${1:-http://localhost:4000}"
PASS=0
FAIL=0

check() {
  if [ "$2" = "true" ]; then
    echo "  PASS: $1"
    PASS=$((PASS+1))
  else
    echo "  FAIL: $1"
    FAIL=$((FAIL+1))
  fi
}

echo "=== Logging in as executive user ==="
TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"userId":"u_exec"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

echo
echo "=== Fetching the SAME investigation (Revenue/North) in all 3 personas ==="
curl -s "$BASE/api/kpi/revenue/story?region=north&persona=executive" -H "Authorization: Bearer $TOKEN" > /tmp/_pt_exec.json
curl -s "$BASE/api/kpi/revenue/story?region=north&persona=analyst" -H "Authorization: Bearer $TOKEN" > /tmp/_pt_analyst.json
curl -s "$BASE/api/kpi/revenue/story?region=north&persona=operations" -H "Authorization: Bearer $TOKEN" > /tmp/_pt_ops.json

python3 << 'PYEOF'
import json

with open('/tmp/_pt_exec.json') as f: exec_d = json.load(f)
with open('/tmp/_pt_analyst.json') as f: analyst_d = json.load(f)
with open('/tmp/_pt_ops.json') as f: ops_d = json.load(f)

results = []

def check(label, condition):
    results.append((label, bool(condition)))

# --- 7. Persona actually reached the engine, not just the UI ---
check("API accepted a persona param and echoed it back (executive)", exec_d["persona"] == "executive")
check("API accepted a persona param and echoed it back (analyst)", analyst_d["persona"] == "analyst")
check("API accepted a persona param and echoed it back (operations)", ops_d["persona"] == "operations")

# --- Same underlying facts across all 3 (quantitative truth unchanged) ---
check("Same KPI change % across all personas (quantitative truth unchanged)",
      exec_d["change"] == analyst_d["change"] == ops_d["change"])
check("Same top-hypothesis confidence score across all personas",
      exec_d["topHypothesis"]["confidence"]["overall"] == analyst_d["topHypothesis"]["confidence"]["overall"] == ops_d["topHypothesis"]["confidence"]["overall"])
check("Same decision (ACT/INVESTIGATE/ABSTAIN) across all personas",
      exec_d["decision"] == analyst_d["decision"] == ops_d["decision"])

# --- 3. Narrative text genuinely differs, not just truncated ---
check("Executive narrative != Analyst narrative (exact string)",
      exec_d["narrative"] != analyst_d["narrative"])
check("Executive narrative != Operations narrative (exact string)",
      exec_d["narrative"] != ops_d["narrative"])
check("Analyst narrative != Operations narrative (exact string)",
      analyst_d["narrative"] != ops_d["narrative"])
check("Analyst narrative is NOT simply Executive narrative + more text appended",
      not analyst_d["narrative"].startswith(exec_d["narrative"][:40]))

# --- Information density: Analyst view genuinely has more structured detail ---
check("Analyst personaView has a full driver ranking (>1 hypothesis)",
      len(analyst_d["personaView"].get("driverRanking", [])) > 1)
check("Executive personaView does NOT expose the full driver ranking (compact shape)",
      "driverRanking" not in exec_d["personaView"])
check("Operations personaView does NOT expose the full driver ranking (compact shape)",
      "driverRanking" not in ops_d["personaView"])
check("Analyst personaView includes confidence breakdown (checks)",
      "confidenceBreakdown" in analyst_d["personaView"] and analyst_d["personaView"]["confidenceBreakdown"] is not None)
check("Analyst personaView includes alternative hypotheses with reasoning",
      len(analyst_d["personaView"].get("alternativeHypotheses", [])) > 0 and
      "whyRankedLower" in analyst_d["personaView"]["alternativeHypotheses"][0])
check("Analyst personaView includes calculation lineage",
      analyst_d["personaView"].get("lineage") is not None)
check("Analyst personaView includes analytical method list",
      len(analyst_d["personaView"].get("analyticalMethod", [])) > 0)

# --- Recommendation presentation differs in shape, not just wording ---
check("Executive personaView recommendation has owner/impact/monitoring compact fields",
      all(k in exec_d["personaView"] for k in ["owner", "impact", "monitoring", "action"]))
check("Operations personaView recommendation is framed around lever, not business impact",
      "controllableLever" in ops_d["personaView"] and "impact" not in ops_d["personaView"])
check("Executive personaView is NOT framed around 'controllable lever' (operational jargon)",
      "controllableLever" not in exec_d["personaView"])

# --- Causal tags (KNOWN/LIKELY/CORRELATED_ONLY) surfaced for Analyst ---
check("Analyst driver ranking includes causalTag (KNOWN/LIKELY/CORRELATED_ONLY)",
      "causalTag" in analyst_d["personaView"]["driverRanking"][0])

# --- 6. RBAC independence: persona never appears in the region-guard logic ---
# (separately verified live below, not from this JSON — see script tail)

print()
print("=" * 70)
passed = sum(1 for _, ok in results if ok)
failed = sum(1 for _, ok in results if not ok)
for label, ok in results:
    print(f"  {'PASS' if ok else 'FAIL'}: {label}")
print("=" * 70)
print(f"RESULT: {passed} passed, {failed} failed")
if failed > 0:
    raise SystemExit(1)
PYEOF
rm -f /tmp/_pt_exec.json /tmp/_pt_analyst.json /tmp/_pt_ops.json

echo
echo "=== RBAC independence check (point #6): persona must never bypass region access ==="
TOKEN_MGR=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"userId":"u_mgr_north"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
CODE_BLOCKED=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/kpi/revenue/story?region=south&persona=analyst" -H "Authorization: Bearer $TOKEN_MGR")
CODE_ALLOWED=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/kpi/revenue/story?region=north&persona=analyst" -H "Authorization: Bearer $TOKEN_MGR")
check "North-scoped manager still blocked from South even in Analyst view (403)" "$([ "$CODE_BLOCKED" = "403" ] && echo true || echo false)"
check "Same manager still allowed North in Analyst view (200)" "$([ "$CODE_ALLOWED" = "200" ] && echo true || echo false)"

echo
if [ "$FAIL" -eq 0 ]; then
  echo "ALL RBAC CHECKS PASSED ($PASS/$PASS)"
else
  echo "RBAC CHECKS: $PASS passed, $FAIL failed"
  exit 1
fi
