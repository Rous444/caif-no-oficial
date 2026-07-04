#!/bin/bash
set -e

mkdir -p test

echo "========================================="
echo "  MediCare Test Runner"
echo "  $(date)"
echo "========================================="
echo ""

echo "[1/4] Lint..."
echo "=== Lint Results ===" > test/lint-results.txt
echo "Date: $(date)" >> test/lint-results.txt
echo "" >> test/lint-results.txt
bun run lint 2>&1 | tee -a test/lint-results.txt
echo "" >> test/lint-results.txt
echo "Exit code: $?" >> test/lint-results.txt
echo ""

echo "[2/4] Type Check..."
echo "=== Type Check Results ===" > test/typecheck-results.txt
echo "Date: $(date)" >> test/typecheck-results.txt
echo "" >> test/typecheck-results.txt
bunx tsc --noEmit 2>&1 | tee -a test/typecheck-results.txt
echo "" >> test/typecheck-results.txt
echo "Exit code: $?" >> test/typecheck-results.txt
echo ""

echo "[3/4] Unit Tests..."
echo "=== Unit Test Results ===" > test/unit-results.txt
echo "Date: $(date)" >> test/unit-results.txt
echo "" >> test/unit-results.txt
bun run test 2>&1 | tee -a test/unit-results.txt
echo "" >> test/unit-results.txt
echo "Exit code: $?" >> test/unit-results.txt
echo ""

echo "[4/4] Build..."
echo "=== Build Results ===" > test/build-results.txt
echo "Date: $(date)" >> test/build-results.txt
echo "" >> test/build-results.txt
bun run build 2>&1 | tee -a test/build-results.txt
echo "" >> test/build-results.txt
echo "Exit code: $?" >> test/build-results.txt
echo ""

echo "========================================="
echo "  All tests completed!"
echo "  Results saved to test/ directory"
echo "========================================="
