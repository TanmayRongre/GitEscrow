import { GitHubIssue, GitHubIssueComment, GitHubRepo } from "../github/types";
import { AnalysisConfidence, AnalysisStatus } from "./types";

export interface IssueValidationResult {
  isValid: boolean;
  status: AnalysisStatus;
  confidence: AnalysisConfidence;
  insufficientReason?: string;
  missingInformation: string[];
  sponsorQuestions: string[];
  improvementSuggestions: string[];
  evidenceCoverage: number; // 0 to 100
  extractedEvidence: {
    checklistItems: string[];
    codeReferences: string[];
    technicalComments: string[];
    errorIndicators: string[];
    keyTopics: string[];
  };
}

const GREETING_PATTERNS = [
  /^(hi|hello|hey|hola|bonjour|ciao|namaste|yo|greetings|good\s*(morning|afternoon|evening|day))[\s!.]*$/i,
  /^(help|please\s*help|pls\s*help|need\s*help|help\s*me)[\s!.]*$/i,
];

const PLACEHOLDER_PATTERNS = [
  /^no\s*description(\s*provided)?\.?$/i,
  /^(none|n\/?a|nil|todo|tbd|null|empty|as\s*above|see\s*title|\.+|-+)$/i,
];

const GENERIC_ONE_LINERS = [
  /^(fix(\s*this|\s*bug)?|bug|broken|not\s*working|doesn'?t\s*work|issue|error|problem|update\s*app|please\s*fix|solve\s*this)[\s!.]*$/i,
];

const NOISE_COMMENT_PATTERNS = [
  /^\+1$/,
  /^(bump|following|same|me\s*too|any\s*update\??|ping|subscribed?|thanks|thx)[\s!.]*$/i,
  /^(hi|hello|hey|hola|good\s*morning)[\s!.]*$/i,
];

const TECHNICAL_KEYWORDS = [
  "error",
  "exception",
  "stack",
  "trace",
  "reproduce",
  "reproduction",
  "regression",
  "crash",
  "panic",
  "fail",
  "failure",
  "timeout",
  "leak",
  "buffer",
  "overflow",
  "nullpointer",
  "typeerror",
  "rangeerror",
  "syntaxerror",
  "undefined",
  "nan",
  "async",
  "promise",
  "callback",
  "api",
  "endpoint",
  "function",
  "class",
  "method",
  "component",
  "hook",
  "module",
  "package",
  "import",
  "export",
  "database",
  "query",
  "schema",
  "sql",
  "http",
  "header",
  "token",
  "cors",
  "auth",
  "test",
  "spec",
  "mock",
  "patch",
  "diff",
  "commit",
];

export class IssueValidator {
  /**
   * Determine whether a string looks like a personal username or handle
   */
  public static isUsernameLike(str: string, authorLogin?: string): boolean {
    const trimmed = str.trim();
    if (!trimmed) return false;

    // Direct match with issue author
    if (authorLogin && trimmed.toLowerCase() === authorLogin.toLowerCase()) {
      return true;
    }
    if (
      authorLogin &&
      trimmed.toLowerCase() === `@${authorLogin.toLowerCase()}`
    ) {
      return true;
    }

    // Single token handle syntax e.g. @username
    if (/^@[a-zA-Z0-9_.-]+$/.test(trimmed)) {
      return true;
    }

    // Single word token with no spaces or sentence punctuation
    // e.g. "YasirBinMudassir" or "tanmayrongre" or "johndoe123"
    if (/^[A-Za-z0-9_-]{3,40}$/.test(trimmed)) {
      const lower = trimmed.toLowerCase();
      // If it contains known technical keywords, it might be a module or error name
      const hasTechKeyword = TECHNICAL_KEYWORDS.some((kw) =>
        lower.includes(kw),
      );
      if (!hasTechKeyword) {
        // PascalCase/camelCase names like YasirBinMudassir
        const hasMixedCase = /[a-z]/.test(trimmed) && /[A-Z]/.test(trimmed);
        if (hasMixedCase || /^[a-z0-9_-]+$/.test(trimmed)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Determine whether text is a simple greeting or conversation opener
   */
  public static isGreeting(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;
    if (GREETING_PATTERNS.some((p) => p.test(trimmed))) return true;

    // Check sentence/clause containing solely conversational greetings / pleas
    const cleaned = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const words = cleaned.split(" ");
    const greetingWords = new Set([
      "hi",
      "hello",
      "hey",
      "hola",
      "bonjour",
      "greetings",
      "good",
      "morning",
      "afternoon",
      "evening",
      "team",
      "guys",
      "everyone",
      "all",
      "pls",
      "please",
      "help",
      "me",
      "can",
      "someone",
      "anybody",
      "thanks",
      "thank",
      "you",
      "thx",
      "sir",
      "madam",
      "dear",
      "need",
      "urgent",
    ]);

    if (words.length > 0 && words.every((w) => greetingWords.has(w))) {
      return true;
    }
    return false;
  }

  /**
   * Determine whether text is an empty or placeholder description
   */
  public static isPlaceholder(text: string | null | undefined): boolean {
    if (!text) return true;
    const trimmed = text.trim();
    if (trimmed.length === 0) return true;
    return PLACEHOLDER_PATTERNS.some((p) => p.test(trimmed));
  }

  /**
   * Determine whether text is a generic one-liner lacking actionable context
   */
  public static isGenericOneLiner(text: string): boolean {
    const trimmed = text.trim();
    if (GENERIC_ONE_LINERS.some((p) => p.test(trimmed))) return true;
    if (trimmed.length < 25) {
      const lower = trimmed.toLowerCase();
      const hasTechKeyword = TECHNICAL_KEYWORDS.some((kw) =>
        lower.includes(kw),
      );
      const hasCode = /[`{}\[\]<>()\/\\=]/.test(trimmed);
      return !hasTechKeyword && !hasCode;
    }
    return false;
  }

  /**
   * Filter comments to extract technical substance, rejecting conversational noise
   */
  public static filterTechnicalComments(comments: GitHubIssueComment[] = []): {
    technical: GitHubIssueComment[];
    noiseCount: number;
  } {
    const technical: GitHubIssueComment[] = [];
    let noiseCount = 0;

    for (const comment of comments) {
      const body = (comment.body || "").trim();
      if (!body) {
        noiseCount++;
        continue;
      }

      if (NOISE_COMMENT_PATTERNS.some((p) => p.test(body))) {
        noiseCount++;
        continue;
      }

      // Check for technical signals: code blocks, stack traces, file paths, keywords
      const hasCodeBlock =
        /```[\s\S]*?```/.test(body) || /`[^`\n]+`/.test(body);
      const hasStackTrace =
        /(at\s+[\w\d_.$<>]+\s+\(|Traceback \(most recent call last\)|Error:)/i.test(
          body,
        );
      const hasFilePath =
        /([\w\-_\/.]+\.(ts|js|jsx|tsx|py|go|rs|java|c|cpp|json|yml|yaml|css|html))/i.test(
          body,
        );
      const lower = body.toLowerCase();
      const techKeywordCount = TECHNICAL_KEYWORDS.filter((kw) =>
        lower.includes(kw),
      ).length;

      if (
        hasCodeBlock ||
        hasStackTrace ||
        hasFilePath ||
        techKeywordCount >= 2 ||
        body.length > 80
      ) {
        technical.push(comment);
      } else {
        noiseCount++;
      }
    }

    return { technical, noiseCount };
  }

  /**
   * Extract code references, checklist items, and error indicators from text
   */
  public static extractEvidenceDetails(text: string): {
    checklistItems: string[];
    codeReferences: string[];
    errorIndicators: string[];
  } {
    const checklistItems: string[] = [];
    const codeReferences: string[] = [];
    const errorIndicators: string[] = [];

    const lines = text.split("\n");
    for (const line of lines) {
      const checkMatch = line.match(/^[-*]\s*\[([ xX])\]\s*(.+)$/);
      if (checkMatch && checkMatch[2].trim()) {
        checklistItems.push(checkMatch[2].trim());
      }
      if (
        /error|exception|failure|crash|panic|broken/i.test(line) &&
        line.length < 120
      ) {
        errorIndicators.push(line.trim());
      }
    }

    const codeMatches = text.match(/`([^`\n]+)`/g) || [];
    const refSet = new Set<string>();
    for (const m of codeMatches) {
      const clean = m.replace(/`/g, "").trim();
      if (
        clean.length > 2 &&
        clean.length < 50 &&
        !clean.includes(" ") &&
        (clean.includes(".") ||
          clean.includes("/") ||
          clean.includes("-") ||
          clean.includes("("))
      ) {
        refSet.add(clean);
      }
    }

    return {
      checklistItems: checklistItems.slice(0, 10),
      codeReferences: Array.from(refSet).slice(0, 10),
      errorIndicators: errorIndicators.slice(0, 5),
    };
  }

  /**
   * Main evaluation entry point
   */
  public static evaluate(
    issue: GitHubIssue,
    repo: GitHubRepo | null,
    comments: GitHubIssueComment[] = [],
  ): IssueValidationResult {
    const rawTitle = (issue.title || "").trim();
    const rawBody = (issue.body || "").trim();
    const author = issue.user?.login;

    const isTitleUsername = this.isUsernameLike(rawTitle, author);
    const isTitleGreeting = this.isGreeting(rawTitle);
    const isTitleGeneric = this.isGenericOneLiner(rawTitle);

    const isBodyEmptyOrPlaceholder = this.isPlaceholder(rawBody);
    const isBodyGreeting =
      !isBodyEmptyOrPlaceholder && this.isGreeting(rawBody);
    const isBodyGeneric =
      !isBodyEmptyOrPlaceholder && this.isGenericOneLiner(rawBody);

    const { technical: technicalComments } =
      this.filterTechnicalComments(comments);

    // Combine all available context for evidence extraction
    const combinedContent = [
      rawTitle,
      rawBody,
      ...technicalComments.map((c) => c.body || ""),
    ].join("\n\n");

    const evidence = this.extractEvidenceDetails(combinedContent);
    const technicalCommentSummaries = technicalComments.map(
      (c) => `@${c.user?.login || "user"}: ${(c.body || "").substring(0, 150)}`,
    );

    // Calculate preliminary evidence score (0 - 100)
    let evidenceScore = 0;
    if (!isTitleUsername && !isTitleGreeting && rawTitle.length > 10)
      evidenceScore += 20;
    if (!isBodyEmptyOrPlaceholder && !isBodyGreeting) {
      if (rawBody.length > 150) evidenceScore += 35;
      else if (rawBody.length > 40) evidenceScore += 20;
    }
    if (evidence.checklistItems.length > 0) evidenceScore += 20;
    if (evidence.codeReferences.length > 0) evidenceScore += 15;
    if (evidence.errorIndicators.length > 0) evidenceScore += 10;
    if (technicalComments.length > 0) evidenceScore += 20;

    const evidenceCoverage = Math.min(100, Math.max(0, evidenceScore));

    // SCENARIO 1: Severe Insufficient Evidence
    // Username as title or greeting-only or empty description without technical comments
    const hasTechnicalSubstance =
      evidence.checklistItems.length > 0 ||
      evidence.codeReferences.length > 0 ||
      evidence.errorIndicators.length > 0 ||
      technicalComments.length > 0;

    const isSevereInsufficient =
      ((isTitleUsername || isTitleGreeting) &&
        (isBodyEmptyOrPlaceholder || isBodyGreeting)) ||
      (isTitleGreeting && !hasTechnicalSubstance) ||
      (isBodyGreeting && !hasTechnicalSubstance && rawTitle.length < 25);

    if (isSevereInsufficient) {
      let specificReason =
        "The issue provides insufficient information to generate verifiable milestones.";
      if (isTitleUsername && isBodyEmptyOrPlaceholder) {
        specificReason = `The issue title ("${rawTitle}") appears to be a username/handle rather than a problem statement, and no technical description was provided.`;
      } else if (isTitleGreeting || isBodyGreeting) {
        specificReason = `The issue contains only conversational greetings ("${rawTitle}" / "${rawBody.substring(0, 40)}") without technical scope or defect details.`;
      }

      return {
        isValid: false,
        status: "INSUFFICIENT_EVIDENCE",
        confidence: "LOW",
        insufficientReason: specificReason,
        missingInformation: [
          "Defect reproduction steps or detailed feature requirements",
          "Expected versus actual behavior",
          "Affected components, files, or API endpoints",
          "Error logs, stack traces, or relevant test cases",
        ],
        sponsorQuestions: [
          "What specific bug, task, or deliverable should this bounty fund?",
          "Which repository files or modules need to be modified?",
          "What concrete acceptance criteria must a contributor fulfill to receive payment?",
        ],
        improvementSuggestions: [
          "Update the GitHub issue title to clearly describe the technical problem or feature.",
          "Add a detailed description with steps to reproduce and expected outcomes.",
          "Define measurable checklist criteria directly in the issue body before funding.",
        ],
        evidenceCoverage: 0,
        extractedEvidence: {
          checklistItems: [],
          codeReferences: [],
          technicalComments: [],
          errorIndicators: [],
          keyTopics: [],
        },
      };
    }

    // SCENARIO 2: Needs More Information
    // Generic one-liner or vague summary without reproduction or technical comments
    const isNeedsMoreInfo =
      (isTitleGeneric ||
        isBodyGeneric ||
        (rawTitle.length < 15 && isBodyEmptyOrPlaceholder)) &&
      evidence.checklistItems.length === 0 &&
      evidence.codeReferences.length === 0 &&
      technicalComments.length === 0;

    if (isNeedsMoreInfo) {
      return {
        isValid: false,
        status: "NEEDS_MORE_INFORMATION",
        confidence: "LOW",
        insufficientReason: `The issue description is too brief or generic ("${rawTitle}") to establish verifiable acceptance criteria without inventing requirements.`,
        missingInformation: [
          "Step-by-step reproduction instructions or system behavior details",
          "Specific module or subsystem references",
          "Test specifications or expected output verification",
        ],
        sponsorQuestions: [
          "Can you provide reproduction steps or an example payload?",
          "What acceptance criteria will you use to verify the solution before releasing escrow?",
        ],
        improvementSuggestions: [
          "Expand the issue description with reproduction steps and expected behavior.",
          "Attach logs, stack traces, or screenshots if applicable.",
        ],
        evidenceCoverage: Math.min(25, evidenceCoverage),
        extractedEvidence: {
          checklistItems: evidence.checklistItems,
          codeReferences: evidence.codeReferences,
          technicalComments: [],
          errorIndicators: evidence.errorIndicators,
          keyTopics: [],
        },
      };
    }

    // SCENARIO 3: Valid Technical Issue
    const confidence: AnalysisConfidence =
      evidenceCoverage >= 60
        ? "HIGH"
        : evidenceCoverage >= 35
          ? "MEDIUM"
          : "LOW";

    return {
      isValid: true,
      status: "READY_FOR_REVIEW",
      confidence,
      missingInformation: [],
      sponsorQuestions: [],
      improvementSuggestions: [],
      evidenceCoverage,
      extractedEvidence: {
        checklistItems: evidence.checklistItems,
        codeReferences: evidence.codeReferences,
        technicalComments: technicalCommentSummaries,
        errorIndicators: evidence.errorIndicators,
        keyTopics: [rawTitle.substring(0, 60)],
      },
    };
  }
}
