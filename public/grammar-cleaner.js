/**
 * GrammarCleaner: Live Automatic Grammar, Punctuation & Speech Cleanup Engine
 * 
 * Automatically adjusts grammar, punctuation, capitalization, contractions, and word agreements:
 * 1. Live Speech Recognition (transcription cleanup, spoken punctuation, fillers, stutters)
 * 2. Live Typing (instant word corrections, debounced sentence polish, and field blur polish)
 * 3. Integrates with Compromise NLP (window.nlp) for advanced entity tagging and capitalization.
 */

(function (global) {
  'use strict';

  // Configuration & Persistent State
  const STORAGE_KEY = 'speakstory_auto_grammar_enabled';
  let isEnabled = true;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      isEnabled = saved === 'true';
    }
  } catch (e) {
    // LocalStorage fallback
  }

  const listeners = new Set();

  function notifyChange() {
    listeners.forEach((fn) => {
      try { fn(isEnabled); } catch (err) { console.error(err); }
    });
  }

  // Spoken punctuation synonym definitions
  const SPOKEN_PHRASES = [
    { re: /\b(dot\s+dot\s+dot|three\s+dots)\b/gi, rep: '...' },
    { re: /\b(full\s*stop|period)\b/gi, rep: '.' },
    { re: /\b(question\s+mark|question\s+sign)\b/gi, rep: '?' },
    { re: /\b(exclamation\s+mark|exclamation\s+point)\b/gi, rep: '!' },
    { re: /\b(semi\s+colon|semicolon)\b/gi, rep: ';' },
    { re: /\b(two\s+dots)\b/gi, rep: ':' },
    { re: /\b(new\s+paragraph|next\s+paragraph|paragraph\s+break)\b/gi, rep: '\n\n' },
    { re: /\b(new\s+line|next\s+line|line\s+break)\b/gi, rep: '\n' },
    { re: /\b(open\s+quotes?|start\s+quotes?|begin\s+quotes?)\b/gi, rep: '“' },
    { re: /\b(close\s+quotes?|end\s+quotes?|unquote)\b/gi, rep: '”' },
    { re: /\b(open\s+(?:bracket|parenthesis|paren)|left\s+bracket)\b/gi, rep: '(' },
    { re: /\b(close\s+(?:bracket|parenthesis|paren)|right\s+bracket)\b/gi, rep: ')' },
    { re: /\b(at\s+the\s+rate(?:\s+of)?|at\s+rate|at\s+sign|at\s+symbol)\b/gi, rep: '@' },
    { re: /\b(and\s+sign|and\s+symbol)\b/gi, rep: '&' },
    { re: /\b(hash\s+tag|hashtag|hash\s+sign|pound\s+sign|number\s+sign)\b/gi, rep: '#' },
    { re: /\b(percent\s+sign|percentage)\b/gi, rep: '%' },
    { re: /\b(dollar\s+sign|dollar\s+symbol)\b/gi, rep: '$' },
    { re: /\b(rupee\s+sign|rupee\s+symbol)\b/gi, rep: '₹' },
    { re: /\b(forward\s+slash)\b/gi, rep: '/' },
    { re: /\b(back\s+slash|backslash)\b/gi, rep: '\\' },
    { re: /\b(single\s+quote|apostrophe)\b/gi, rep: "'" },
    { re: /\b(dot)\b/gi, rep: '.' },
    { re: /\b(comma)\b/gi, rep: ',' },
    { re: /\b(exclamation)\b/gi, rep: '!' },
    { re: /\b(colon)\b/gi, rep: ':' },
    { re: /\b(dash)\b/gi, rep: ' – ' },
    { re: /\b(hyphen)\b/gi, rep: '-' },
    { re: /\b(slash)\b/gi, rep: '/' },
    { re: /\b(ampersand)\b/gi, rep: '&' },
    { re: /\b(percent)\b/gi, rep: '%' },
    { re: /\b(rupees?)\b/gi, rep: '₹' }
  ];

  // Common Contraction & Grammatical Replacements
  const GRAMMAR_RULES = [
    // Standard contractions
    { re: /\b(dont)\b/gi, rep: "don't" },
    { re: /\b(doesnt)\b/gi, rep: "doesn't" },
    { re: /\b(didnt)\b/gi, rep: "didn't" },
    { re: /\b(cant)\b/gi, rep: "can't" },
    { re: /\b(wont)\b/gi, rep: "won't" },
    { re: /\b(wouldnt)\b/gi, rep: "wouldn't" },
    { re: /\b(couldnt)\b/gi, rep: "couldn't" },
    { re: /\b(shouldnt)\b/gi, rep: "shouldn't" },
    { re: /\b(isnt)\b/gi, rep: "isn't" },
    { re: /\b(arent)\b/gi, rep: "aren't" },
    { re: /\b(wasnt)\b/gi, rep: "wasn't" },
    { re: /\b(werent)\b/gi, rep: "weren't" },
    { re: /\b(hasnt)\b/gi, rep: "hasn't" },
    { re: /\b(havent)\b/gi, rep: "haven't" },
    { re: /\b(hadnt)\b/gi, rep: "hadn't" },
    { re: /\b(thats)\b/gi, rep: "that's" },
    { re: /\b(whats)\b/gi, rep: "what's" },
    { re: /\b(hows)\b/gi, rep: "how's" },
    { re: /\b(wheres)\b/gi, rep: "where's" },
    { re: /\b(theres)\b/gi, rep: "there's" },
    { re: /\b(heres)\b/gi, rep: "here's" },
    { re: /\b(youre)\b/gi, rep: "you're" },
    { re: /\b(theyre)\b/gi, rep: "they're" },
    { re: /\b(weve)\b/gi, rep: "we've" },
    { re: /\b(theyve)\b/gi, rep: "they've" },
    { re: /\b(youve)\b/gi, rep: "you've" },

    // Pronoun "I" contractions
    { re: /\bim\b/gi, rep: "I'm" },
    { re: /\bi'm\b/gi, rep: "I'm" },
    { re: /\bive\b/gi, rep: "I've" },
    { re: /\bi've\b/gi, rep: "I've" },
    { re: /\bi'll\b/gi, rep: "I'll" },
    { re: /\bi'd\b/gi, rep: "I'd" },
    { re: /\bill\b(?=\s+(?:be|do|see|get|have|go|call|try|make|let|help|take|send|ask|tell|come|work|say|find)\b)/gi, rep: "I'll" },
    { re: /\bid\b(?=\s+(?:like|rather|love|prefer|think|say|suggest|recommend|better)\b)/gi, rep: "I'd" },

    // Imperative let's
    { re: /\blets\b(?=\s+(?:go|do|see|make|get|take|have|try|talk|start|check|look|find|run|eat|read|write|learn|build|discuss)\b)/gi, rep: "let's" },

    // Modal verb prepositions ("could of" -> "could have")
    { re: /\b(could|should|would|might|must)\s+of\b/gi, rep: '$1 have' },

    // Spacing errors / common run-togethers
    { re: /\balot\b/gi, rep: 'a lot' },
    { re: /\binfront\b/gi, rep: 'in front' },
    { re: /\batleast\b/gi, rep: 'at least' },
    { re: /\beachother\b/gi, rep: 'each other' },
    { re: /\baswell\b/gi, rep: 'as well' },
    { re: /\bnevermind\b/gi, rep: 'never mind' },
    { re: /\ballright\b/gi, rep: 'all right' },
    { re: /\bthankyou\b/gi, rep: 'thank you' },

    // Subject-verb agreement (spoken slips)
    { re: /\b(they|we|you)\s+was\b/gi, rep: '$1 were' },
    { re: /\b(they|we|you)\s+wasn't\b/gi, rep: "$1 weren't" },
    { re: /\b(they|we|you)\s+wasnt\b/gi, rep: "$1 weren't" },
    { re: /\b(he|she|it)\s+dont\b/gi, rep: "$1 doesn't" },
    { re: /\b(he|she|it)\s+don't\b/gi, rep: "$1 doesn't" },

    // It's vs its (contextual)
    { re: /\bits\s+(a|an|the|not|been|very|time|going|too|so|really|all|just|worth|about|okay|fine)\b/gi, rep: "it's $1" },

    // Common homophones
    { re: /\byour\s+welcome\b/gi, rep: "you're welcome" },
    { re: /\btheir\s+(is|are|was|were)\b/gi, rep: "there $1" }
  ];

  // Days and Months
  const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const MONTHS_OF_YEAR = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Common proper nouns to preserve capitalization
  const PROPER_NOUNS = [
    'Google', 'Microsoft', 'YouTube', 'Facebook', 'Instagram', 'WhatsApp',
    'India', 'Indian', 'American', 'America', 'English', 'Hindi',
    'London', 'New York', 'Sydney', 'Tokyo', 'Paris'
  ];

  const GrammarCleaner = {
    /**
     * Check if grammar correction is enabled
     */
    isEnabled() {
      return isEnabled;
    },

    /**
     * Enable or disable grammar correction
     */
    setEnabled(val) {
      isEnabled = !!val;
      try {
        localStorage.setItem(STORAGE_KEY, String(true));
      } catch (e) { }
      notifyChange();
    },

    /**
     * Toggle grammar correction on/off
     */
    toggle() {
      this.setEnabled(!isEnabled);
      return isEnabled;
    },

    /**
     * Subscribe to enabled state changes
     */
    onStateChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /**
     * Clean hesitation / filler sounds (e.g. um, uh, er, ah, hmm)
     */
    cleanFillers(text) {
      if (!text) return '';
      return text
        .replace(/(^|[\s,;])\b(um+|uh+|er+|ah+|hmm+)\b([\s,;]|$)/gi, (match, prefix, filler, suffix) => {
          if (prefix && suffix && prefix.trim() === '' && suffix.trim() === '') {
            return ' ';
          }
          return prefix || suffix || '';
        })
        .replace(/[^\S\r\n]{2,}/g, ' ')
        .trim();
    },

    /**
     * Clean immediate duplicate words or stutters from speech engines
     */
    cleanDuplicates(text) {
      if (!text) return '';
      let cleaned = text.replace(/\b([a-zA-Z]+)(?:[,\s]+\1\b)+/gi, (match, word) => {
        if (word.toLowerCase() === 'had') return match;
        return word;
      });
      cleaned = cleaned.replace(/\b([a-zA-Z]+\s+[a-zA-Z]+)(?:[,\s]+\1\b)+/gi, '$1');
      return cleaned;
    },

    /**
     * Apply grammar, contractions, modals, and common speech slip corrections
     */
    cleanGrammarRules(text) {
      if (!text) return '';
      let result = text;

      for (const rule of GRAMMAR_RULES) {
        result = result.replace(rule.re, (match, ...groups) => {
          const rep = rule.rep;
          const isCapitalized = match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase();
          let formatted = rep;

          if (typeof rep === 'string' && rep.includes('$1') && groups[0]) {
            formatted = rep.replace('$1', groups[0]);
          }

          if (isCapitalized && formatted.length > 0) {
            formatted = formatted[0].toUpperCase() + formatted.slice(1);
          }
          return formatted;
        });
      }

      return result;
    },

    /**
     * Indefinite article agreement: "a" vs "an"
     */
    cleanArticles(text) {
      if (!text) return '';
      let result = text;

      // "a" before silent h words -> "an"
      result = result.replace(/\ba\s+(hour|honest|honor|honour|heir)\b/gi, (m, word) => {
        const cap = m[0] === m[0].toUpperCase();
        return (cap ? 'An ' : 'an ') + word;
      });

      // "an" before consonant-sound "u/e/o" -> "a"
      result = result.replace(/\ban\s+(university|uniform|unique|union|unit|user|european|one(?:-\w+)?)\b/gi, (m, word) => {
        const cap = m[0] === m[0].toUpperCase();
        return (cap ? 'A ' : 'a ') + word;
      });

      // General "a" before vowel -> "an"
      result = result.replace(/\ba\s+([aeiouAEIOU][a-zA-Z]*)\b/gi, (m, word) => {
        const lowerWord = word.toLowerCase();
        if (/^(?:university|uniform|unique|union|unit|user|european|one)/i.test(lowerWord)) {
          return m;
        }
        const cap = m[0] === m[0].toUpperCase();
        return (cap ? 'An ' : 'an ') + word;
      });

      // General "an" before consonant -> "a"
      result = result.replace(/\ban\s+([^aeiouAEIOU\s][a-zA-Z]*)\b/gi, (m, word) => {
        const lowerWord = word.toLowerCase();
        if (/^(?:hour|honest|honor|honour|heir)/i.test(lowerWord)) {
          return m;
        }
        const cap = m[0] === m[0].toUpperCase();
        return (cap ? 'A ' : 'a ') + word;
      });

      return result;
    },

    /**
     * Capitalization of pronoun "I", calendar terms, honorifics, proper nouns, and sentence boundaries
     */
    cleanCapitalization(text) {
      if (!text) return '';
      let result = text;

      // Standalone pronoun "i"
      result = result.replace(/\bi\b/g, 'I');

      // Honorifics: dr, mr, mrs, ms, prof -> Dr., Mr., etc.
      result = result.replace(/\b(dr|mr|mrs|ms|prof)\b(?=\.?\s+[A-Za-z])/gi, (m) => {
        return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
      });

      // Days of week
      for (const day of DAYS_OF_WEEK) {
        const re = new RegExp(`\\b${day}\\b`, 'gi');
        result = result.replace(re, day);
      }

      // Months of year
      for (const month of MONTHS_OF_YEAR) {
        const re = new RegExp(`\\b${month}\\b`, 'gi');
        result = result.replace(re, month);
      }

      // Common proper nouns
      for (const noun of PROPER_NOUNS) {
        const re = new RegExp(`\\b${noun}\\b`, 'gi');
        result = result.replace(re, noun);
      }

      // Capitalize first character of text
      result = result.replace(/^([a-z])/, (m) => m.toUpperCase());

      // Capitalize after sentence terminators (. ? ! or \n)
      result = result.replace(/([.!?]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
      result = result.replace(/(\n+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());

      return result;
    },

    /**
     * Spacing, quotation, and punctuation normalization
     */
    cleanSpacingAndPunctuation(text) {
      if (!text) return '';
      let result = text;

      // Normalize whitespace around newlines
      result = result.replace(/[^\S\r\n]*\n[^\S\r\n]*/g, '\n');

      // Remove space before punctuation marks: . , ! ? : ; ) ] ” %
      result = result.replace(/\s+([.,!?:;)\]”%])/g, '$1');

      // Remove space after opening brackets / quotes: ( [ “
      result = result.replace(/([(\[“])\s+/g, '$1');

      // Space after punctuation if followed by word/number
      result = result.replace(/([,!?:;])([A-Za-z0-9])/g, '$1 $2');
      result = result.replace(/(\D\.)([A-Za-z])/g, '$1 $2');

      // Convert smart quotes to standard quotes
      result = result.replace(/[“”]/g, '"');

      // Normalize multiple consecutive horizontal spaces
      result = result.replace(/[^\S\r\n]{2,}/g, ' ');

      return result;
    },

    /**
     * Natural Language Processing Entity & Structure Pass (via Compromise nlp if available)
     */
    applyNlpEnhancements(text) {
      if (!text || typeof global.nlp !== 'function') {
        return text;
      }

      try {
        const doc = global.nlp(text);

        // Detect Places entities and ensure Title Case
        doc.places().forEach((p) => {
          const original = p.text();
          if (original && original.length > 1) {
            const titled = original
              .split(/\s+/)
              .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
              .join(' ');
            p.replaceWith(titled);
          }
        });

        // Detect Organizations entities and ensure Title Case
        doc.organizations().forEach((org) => {
          const original = org.text();
          if (original && original.length > 1) {
            const titled = original
              .split(/\s+/)
              .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
              .join(' ');
            org.replaceWith(titled);
          }
        });

        return doc.text();
      } catch (err) {
        // Fallback safely to rule-based engine
        return text;
      }
    },

    /**
     * Fast Word-Boundary Cleaner for Real-Time Typing
     * Triggered when the user types a space or punctuation mark.
     * Evaluates the word or 2-word phrase right before the cursor and returns a fix if needed.
     * 
     * @param {string} textBeforeCaret - String from start of input up to cursor
     * @returns {{ replacedText: string, changed: boolean }}
     */
    cleanTypingWord(textBeforeCaret) {
      if (!isEnabled || !textBeforeCaret) {
        return { replacedText: textBeforeCaret, changed: false };
      }

      let modified = textBeforeCaret;

      // 1. Capitalize standalone "i "
      modified = modified.replace(/(^|[\s.,!?;])i(\s+)$/, '$1I$2');

      // 2. Contractions on word boundary
      modified = modified.replace(/(^|[\s])(dont|doesnt|didnt|cant|wont|wouldnt|couldnt|shouldnt|isnt|arent|wasnt|werent|hasnt|havent|hadnt|thats|whats|hows|wheres|theres|heres|youre|theyre|weve|theyve|youve|im|ive)(\s+)$/i, (m, p1, word, space) => {
        let rep = word.toLowerCase();
        const rule = GRAMMAR_RULES.find((r) => r.re.test(rep));
        let fixed = rule ? rule.rep : word;
        if (word[0] === word[0].toUpperCase()) {
          fixed = fixed.charAt(0).toUpperCase() + fixed.slice(1);
        }
        return p1 + fixed + space;
      });

      // 3. Fast phrases before cursor (e.g. "could of ", "alot ", "infront ")
      modified = modified.replace(/\b(could|should|would|might|must)\s+of(\s+)$/i, '$1 have$2');
      modified = modified.replace(/\balot(\s+)$/i, 'a lot$1');
      modified = modified.replace(/\binfront(\s+)$/i, 'in front$1');

      // 4. Quick article fix: "a apple " -> "an apple "
      modified = this.cleanArticles(modified);

      // 5. Capitalize first letter of whole text or after sentence terminator
      modified = modified.replace(/^([a-z])/, (m) => m.toUpperCase());
      modified = modified.replace(/([.!?]\s+)([a-z])$/, (m, p1, p2) => p1 + p2.toUpperCase());

      const changed = modified !== textBeforeCaret;
      return { replacedText: modified, changed };
    },

    /**
     * Clean Spoken Recognition Text
     * Handles spoken punctuation synonyms, fillers, stutters, and grammar.
     * 
     * @param {string} rawSpokenText - Raw string from SpeechRecognition
     * @param {Object} options - Options { isInterim: boolean }
     * @returns {string} Cleaned, formatted speech text
     */
    cleanSpokenText(rawSpokenText, options = {}) {
      if (!rawSpokenText) return '';
      let text = rawSpokenText;

      // Always translate spoken punctuation commands (e.g. "full stop" -> ".")
      for (const { re, rep } of SPOKEN_PHRASES) {
        text = text.replace(re, rep);
      }

      if (!isEnabled) {
        // If grammar engine is toggled off, still do standard punctuation spacing & casing
        text = this.cleanSpacingAndPunctuation(text);
        text = text.replace(/^([a-z])/, (m) => m.toUpperCase());
        return text;
      }

      // 1. Remove hesitation fillers (um, uh, er, etc.)
      text = this.cleanFillers(text);

      // 2. Remove speech engine duplicates / stutters
      text = this.cleanDuplicates(text);

      // 3. Apply grammar and contractions
      text = this.cleanGrammarRules(text);

      // 4. Apply article agreement ("a" vs "an")
      text = this.cleanArticles(text);

      // 5. Spacing and punctuation normalization
      text = this.cleanSpacingAndPunctuation(text);

      // 6. NLP proper noun enhancements (for finalized chunks)
      if (!options.isInterim) {
        text = this.applyNlpEnhancements(text);
      }

      // 7. Sentence & pronoun capitalization
      text = this.cleanCapitalization(text);

      return text;
    },

    /**
     * Master Clean Function for Field Content
     * 
     * @param {string} rawText - Full field value
     * @param {Object} options - { finalize: boolean }
     * @returns {string} Completely cleaned manuscript text
     */
    cleanText(rawText, options = {}) {
      if (!rawText) return '';
      let text = rawText;

      // 1. Spoken phrases / punctuation
      for (const { re, rep } of SPOKEN_PHRASES) {
        text = text.replace(re, rep);
      }

      if (!isEnabled) {
        text = this.cleanSpacingAndPunctuation(text);
        text = text.replace(/^([a-z])/, (m) => m.toUpperCase());
        return text;
      }

      // 2. Speech fillers
      text = this.cleanFillers(text);

      // 3. Duplicate words
      text = this.cleanDuplicates(text);

      // 4. Contractions & grammar
      text = this.cleanGrammarRules(text);

      // 5. Articles ("a" vs "an")
      text = this.cleanArticles(text);

      // 6. Spacing & punctuation
      text = this.cleanSpacingAndPunctuation(text);

      // 7. NLP entity capitalization
      text = this.applyNlpEnhancements(text);

      // 8. Capitalization
      text = this.cleanCapitalization(text);

      // 9. If finalizing sentence (e.g. blur or stop recording with 3+ words and no trailing punctuation)
      if (options.finalize) {
        const trimmed = text.trim();
        const words = trimmed.split(/\s+/);
        if (words.length >= 3 && !/[.!?…:;,–-]$/.test(trimmed)) {
          text = trimmed + '.';
        }
      }

      return text;
    }
  };

  // Export to window or global
  global.GrammarCleaner = GrammarCleaner;

})(typeof window !== 'undefined' ? window : globalThis);
