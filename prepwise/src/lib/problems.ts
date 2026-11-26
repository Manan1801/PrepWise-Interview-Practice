/**
 * Hand-checked coding problems. When the planner wants a coding question it picks one of these by id, so the
 * problem statement and example outputs are always correct (every example below was verified by running a
 * reference solution). If the planner picks no valid id, its own problem is used instead.
 */
export interface Problem {
  id: string;
  title: string;
  level: "easy" | "medium";
  statement: string; // includes stdin/stdout format and examples, so the candidate can test with ▶ Run
  points: string[]; // rubric
  hint: string;
}

export const PROBLEMS: Problem[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    level: "easy",
    statement:
      "Given an array of integers and a target, print the indices of the two numbers that add up to the target (exactly one answer exists). Input: n, then n integers, then the target. Example: n=4, [2 7 11 15], target 9 → 0 1. Another: [3 2 4], target 6 → 1 2.",
    points: ["Hash map from value to index (one pass)", "O(n) time, O(n) space vs O(n²) brute force", "Edge cases: duplicates like [3 3], negatives", "Correct, clean code"],
    hint: "For each number, what other number would complete the pair? Where could you look that up in O(1)?",
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    level: "easy",
    statement:
      'Given a string containing only ()[]{} characters, print true if the brackets are balanced and correctly nested, otherwise false. Input: one line with the string. Examples: "([]{})" → true, "(]" → false, "([)]" → false.',
    points: ["Use a stack of open brackets", "Check match on every closing bracket and an empty stack at the end", "O(n) time, O(n) space", "Edge cases: empty string, starts with a closing bracket"],
    hint: "When you see a closing bracket, which opening bracket must it match?",
  },
  {
    id: "max-subarray",
    title: "Maximum Subarray Sum",
    level: "easy",
    statement:
      "Given an array of integers (may be negative), print the largest sum of any non-empty contiguous subarray. Input: n, then n integers. Example: [-2 1 -3 4 -1 2 1 -5 4] → 6 (subarray 4 -1 2 1).",
    points: ["Kadane's algorithm: extend or restart the running sum", "O(n) time, O(1) space", "Edge case: all numbers negative", "Correct, clean code"],
    hint: "At each position, is it better to extend the previous subarray or start fresh here?",
  },
  {
    id: "longest-unique-substring",
    title: "Longest Substring Without Repeating Characters",
    level: "medium",
    statement:
      'Given a string, print the length of the longest substring with no repeating characters. Input: one line with the string. Examples: "abcabcbb" → 3 ("abc"), "pwwkew" → 3 ("wke").',
    points: ["Sliding window with two pointers", "Map/array of last-seen positions to jump the left pointer", "O(n) time", "Edge cases: empty string, all same characters"],
    hint: "Keep a window with no repeats. When a repeat enters, where should the window's left edge move?",
  },
  {
    id: "zero-sum-subarray",
    title: "Longest Zero-Sum Subarray",
    level: "medium",
    statement:
      "Given an array of integers, print the length of the longest contiguous subarray whose sum is 0 (print 0 if none). Input: n, then n integers. Example: [15 -2 2 -8 1 7 10 23] → 5 (subarray -2 2 -8 1 7).",
    points: ["Prefix sums: equal prefix sums mean a zero-sum range between them", "Hash map storing the first index of each prefix sum (prefix 0 at index -1)", "O(n) time, O(n) space", "Edge cases: whole array sums to 0, no zero-sum subarray"],
    hint: "If the running sum is the same at two positions, what is the sum of the elements between them?",
  },
  {
    id: "merge-intervals",
    title: "Merge Intervals",
    level: "medium",
    statement:
      "Given n intervals [start, end], merge all overlapping intervals and print the result sorted by start, one interval per line. Input: n, then n lines of start end. Example: [1,3] [2,6] [8,10] [15,18] → [1,6] [8,10] [15,18].",
    points: ["Sort by start time", "Merge when the next start ≤ current end, keep the max end", "O(n log n) time", "Edge cases: touching intervals like [1,4] [4,5], one interval inside another"],
    hint: "If the intervals were sorted by start, when does a new interval overlap the last merged one?",
  },
  {
    id: "kth-largest",
    title: "Kth Largest Element",
    level: "medium",
    statement:
      "Given an array and k, print the k-th largest element (in sorted order, not the k-th distinct). Input: n and k, then n integers. Examples: [3 2 1 5 6 4], k=2 → 5; [3 2 3 1 2 4 5 5 6], k=4 → 4.",
    points: ["Min-heap of size k (O(n log k)) or quickselect (average O(n))", "Compare with sorting O(n log n)", "Duplicates count separately", "Correct, clean code"],
    hint: "Do you need to sort everything, or just keep track of the k largest seen so far?",
  },
  {
    id: "number-of-islands",
    title: "Number of Islands",
    level: "medium",
    statement:
      "Given a grid of '1' (land) and '0' (water), print the number of islands (groups of land connected up, down, left or right). Input: rows and cols, then the grid rows. Example: 11000 / 11000 / 00100 / 00011 → 3.",
    points: ["DFS or BFS flood fill from each unvisited land cell", "Mark visited cells", "O(rows × cols) time", "Edge cases: empty grid, all water, recursion depth on large grids"],
    hint: "When you find a land cell, how can you mark the whole island so you don't count it twice?",
  },
  {
    id: "search-rotated",
    title: "Search in Rotated Sorted Array",
    level: "medium",
    statement:
      "A sorted array of distinct integers was rotated at an unknown point. Print the index of the target, or -1 if absent, in O(log n). Input: n, then n integers, then the target. Examples: [4 5 6 7 0 1 2], target 0 → 4; target 3 → -1.",
    points: ["Modified binary search", "Decide which half is sorted, then whether the target lies in it", "O(log n) time", "Edge cases: not rotated, single element, target absent"],
    hint: "In a binary search step, at least one half is always sorted. How does that help?",
  },
  {
    id: "product-except-self",
    title: "Product of Array Except Self",
    level: "medium",
    statement:
      "Given an array, print an array where each position holds the product of all other elements, without using division. Input: n, then n integers. Example: [1 2 3 4] → [24 12 8 6].",
    points: ["Prefix products and suffix products", "O(n) time, O(1) extra space besides the output", "Why not division: zeros", "Correct, clean code"],
    hint: "The answer at i is (product of everything left of i) × (product of everything right of i).",
  },
  {
    id: "coin-change",
    title: "Coin Change (fewest coins)",
    level: "medium",
    statement:
      "Given coin denominations and an amount, print the fewest coins needed to make the amount, or -1 if impossible (unlimited coins of each type). Input: n and amount, then n coin values. Examples: coins [1 2 5], amount 11 → 3 (5+5+1); coins [2], amount 3 → -1.",
    points: ["Dynamic programming over amounts 0..amount", "dp[x] = min(dp[x - coin] + 1)", "O(amount × n) time, O(amount) space", "Why greedy fails in general; unreachable amounts"],
    hint: "If you knew the fewest coins for every smaller amount, how would you get the answer for this one?",
  },
  {
    id: "first-unique-char",
    title: "First Non-Repeating Character",
    level: "easy",
    statement:
      'Given a lowercase string, print the index of the first character that appears exactly once, or -1 if none. Input: one line with the string. Examples: "leetcode" → 0, "aabb" → -1.',
    points: ["Count frequencies first (array of 26 or a map)", "Second pass to find the first count of 1", "O(n) time, O(1) space for a fixed alphabet", "Edge cases: empty string, no unique character"],
    hint: "Can you count every character first, then scan again?",
  },
];

export const getProblem = (id: unknown) => PROBLEMS.find((p) => p.id === id);
