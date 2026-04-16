/**
 * Passphrase Generator
 * Generates memorable passphrases using diceware method
 * Uses subset of EFF long wordlist (7776 words)
 */

import type { GeneratedPassword } from './passwordGenerator';

// EFF Long Wordlist subset (384 words - subset for bundle size)
// In production, you could load full 7776 word list from CDN
const DICEWARE_WORDS = [
  'able', 'about', 'account', 'acid', 'across', 'actor', 'actual', 'adapt', 'add', 'address',
  'adjust', 'admit', 'adopt', 'adult', 'advance', 'advice', 'affair', 'affect', 'afford', 'afraid',
  'after', 'again', 'against', 'agency', 'agent', 'agree', 'ahead', 'aim', 'alarm', 'album',
  'alert', 'alien', 'alive', 'allow', 'almost', 'alone', 'along', 'already', 'also', 'alter',
  'always', 'amateur', 'amazing', 'among', 'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger',
  'angle', 'angry', 'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique',
  'anxiety', 'apart', 'apology', 'appear', 'apple', 'approve', 'april', 'arch', 'arctic', 'area',
  'arena', 'argue', 'armed', 'armor', 'army', 'around', 'arrange', 'arrest', 'arrival', 'arrive',
  'arrow', 'artist', 'artwork', 'asking', 'aspect', 'assault', 'asset', 'assist', 'assume', 'asthma',
  'athlete', 'atom', 'attack', 'attend', 'attract', 'auction', 'audit', 'august', 'aunt', 'author',
  'auto', 'autumn', 'average', 'avocado', 'avoid', 'awake', 'aware', 'away', 'awesome', 'awful',
  'awkward', 'axis', 'baby', 'bachelor', 'bacon', 'badge', 'balance', 'balcony', 'ball', 'bamboo',
  'banana', 'banner', 'bargain', 'barrel', 'basic', 'basket', 'battle', 'beach', 'bean', 'beauty',
  'because', 'become', 'beef', 'before', 'begin', 'behave', 'behind', 'believe', 'below', 'belt',
  'bench', 'benefit', 'best', 'betray', 'better', 'between', 'beyond', 'bicycle', 'bind', 'biology',
  'bird', 'birth', 'bitter', 'black', 'blade', 'blame', 'blanket', 'blast', 'bleak', 'bless',
  'blind', 'blood', 'blossom', 'blouse', 'blue', 'blur', 'blush', 'board', 'boat', 'body',
  'boil', 'bomb', 'bone', 'bonus', 'book', 'boost', 'border', 'boring', 'borrow', 'boss',
  'bottom', 'bounce', 'bowl', 'brain', 'brand', 'brass', 'brave', 'bread', 'breeze', 'brick',
  'bridge', 'brief', 'bright', 'bring', 'brisk', 'broccoli', 'broken', 'bronze', 'broom', 'brother',
  'brown', 'brush', 'bubble', 'buddy', 'budget', 'buffalo', 'build', 'bulb', 'bulk', 'bullet',
  'bundle', 'bunker', 'burden', 'burger', 'burst', 'business', 'busy', 'butter', 'buyer', 'buzz',
  'cabbage', 'cabin', 'cable', 'cactus', 'cage', 'cake', 'call', 'calm', 'camera', 'camp',
  'canal', 'cancel', 'candy', 'cannon', 'canoe', 'canvas', 'canyon', 'capable', 'capital', 'captain',
  'carbon', 'card', 'cargo', 'carpet', 'carry', 'cart', 'case', 'cash', 'casino', 'castle',
  'casual', 'catalog', 'catch', 'category', 'cattle', 'caught', 'cause', 'caution', 'cave', 'ceiling',
  'celery', 'cement', 'census', 'century', 'cereal', 'certain', 'chair', 'chalk', 'champion', 'change',
  'chaos', 'chapter', 'charge', 'chase', 'chat', 'cheap', 'check', 'cheese', 'chef', 'cherry',
  'chest', 'chicken', 'chief', 'child', 'chimney', 'choice', 'choose', 'chronic', 'chuckle', 'chunk',
  'churn', 'cigar', 'cinnamon', 'circle', 'citizen', 'city', 'civic', 'civil', 'claim', 'clap',
  'clarify', 'claw', 'clay', 'clean', 'clerk', 'clever', 'click', 'client', 'cliff', 'climb',
  'clinic', 'clip', 'clock', 'clog', 'close', 'cloth', 'cloud', 'clown', 'club', 'clump',
  'cluster', 'clutch', 'coach', 'coast', 'coconut', 'code', 'coffee', 'coil', 'coin', 'collect',
  'color', 'column', 'combine', 'come', 'comfort', 'comic', 'common', 'company', 'concert', 'conduct',
  'confirm', 'congress', 'connect', 'consider', 'control', 'convince', 'cook', 'cool', 'copper', 'copy',
  'coral', 'core', 'corn', 'correct', 'cost', 'cotton', 'couch', 'country', 'couple', 'course',
  'cousin', 'cover', 'coyote', 'crack', 'cradle', 'craft', 'cram', 'crane', 'crash', 'crater',
  'crawl', 'crazy', 'cream', 'credit', 'creek', 'crew', 'cricket', 'crime', 'crisp', 'critic',
  'crop', 'cross', 'crouch', 'crowd', 'crucial', 'cruel', 'cruise', 'crumble', 'crunch', 'crush',
  'crystal', 'cube', 'culture', 'cupboard', 'curious', 'current', 'curtain', 'curve', 'cushion', 'custom',
  'cycle', 'dad', 'damage', 'damp', 'dance', 'danger', 'daring', 'dash', 'daughter', 'dawn',
  'deal', 'debate', 'debris', 'decade', 'december', 'decide', 'decline', 'decorate', 'decrease', 'deer',
  'defense', 'define', 'defy', 'degree', 'delay', 'deliver', 'demand', 'demise', 'denial', 'dentist',
  'deny', 'depart', 'depend', 'deposit', 'depth', 'deputy', 'derive', 'describe', 'desert', 'design'
];

/**
 * Get cryptographically secure random index
 */
function getRandomIndex(max: number): number {
  if (max <= 0) {
    throw new Error('max must be greater than 0');
  }

  const maxUint32 = 0x100000000; // 2^32
  const limit = maxUint32 - (maxUint32 % max);

  while (true) {
    const randomBytes = crypto.getRandomValues(new Uint32Array(1));
    const value = randomBytes[0] ?? 0;

    if (value < limit) {
      return value % max;
    }
  }
}

/**
 * Get a random word from the diceware list
 */
function getRandomWord(): string {
  const index = getRandomIndex(DICEWARE_WORDS.length);
  return DICEWARE_WORDS[index] ?? 'word';
}

/**
 * Capitalize first letter of a word
 */
function capitalizeWord(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Insert random digits between words
 */
function insertRandomDigits(): string {
  const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const index = getRandomIndex(digits.length);
  return digits[index] ?? '0';
}

/**
 * Get random separator character
 */
function getRandomSeparator(separatorSet: 'dash' | 'space' | 'symbol'): string {
  const separators: { [key: string]: string[] } = {
    dash: ['-', '_'],
    space: [' '],
    symbol: ['-', '_', '.', '+', '=', '@', '#'],
  };

  const chars = separators[separatorSet] ?? ['-'];
  const index = getRandomIndex(chars.length);
  return chars[index] ?? '-';
}

export interface PassphraseOptions {
  wordCount: number; // 4-8 words
  separator: 'dash' | 'space' | 'symbol' | 'none';
  capitalize: 'none' | 'first' | 'all' | 'random';
  includeNumbers: boolean;
}

/**
 * Generate a diceware passphrase
 */
export function generatePassphrase(options: PassphraseOptions): GeneratedPassword {
  if (options.wordCount < 4 || options.wordCount > 8) {
    throw new Error('Word count must be between 4 and 8');
  }

  const words: string[] = [];

  // Generate words
  for (let i = 0; i < options.wordCount; i++) {
    let word = getRandomWord();

    // Apply capitalization
    if (options.capitalize === 'all') {
      word = capitalizeWord(word);
    } else if (options.capitalize === 'first' && i === 0) {
      word = capitalizeWord(word);
    } else if (options.capitalize === 'random') {
      if (getRandomIndex(2) === 1) {
        word = capitalizeWord(word);
      }
    }

    words.push(word);
  }

  // Build passphrase with separators
  let passphrase: string;

  if (options.separator === 'none') {
    passphrase = words.join('');
  } else {
    const separator = getRandomSeparator(options.separator);
    passphrase = words.join(separator);
  }

  // Add random numbers if requested
  if (options.includeNumbers) {
    const numDigits = 2 + getRandomIndex(3); // 2-4 digits
    let digits = '';
    for (let i = 0; i < numDigits; i++) {
      digits += insertRandomDigits();
    }

    // Insert at random position
    const insertPosition = getRandomIndex(3); // 0=start, 1=middle, 2=end
    if (insertPosition === 0) {
      passphrase = digits + passphrase;
    } else if (insertPosition === 1) {
      const midpoint = Math.floor(passphrase.length / 2);
      passphrase = passphrase.slice(0, midpoint) + digits + passphrase.slice(midpoint);
    } else {
      passphrase = passphrase + digits;
    }
  }

  // Calculate entropy
  // For diceware: entropy = log2(7776^word_count)
  // Using subset of 384 words: log2(384^word_count)
  const wordlistSize = DICEWARE_WORDS.length;
  const entropy = options.wordCount * Math.log2(wordlistSize);

  // Determine strength based on entropy
  let strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  if (entropy < 40) {
    strength = 'weak';
  } else if (entropy < 60) {
    strength = 'medium';
  } else if (entropy < 80) {
    strength = 'strong';
  } else {
    strength = 'very-strong';
  }

  return {
    password: passphrase,
    entropy: Math.round(entropy * 10) / 10,
    strength,
  };
}

/**
 * Get default passphrase options
 */
export function getDefaultPassphraseOptions(): PassphraseOptions {
  return {
    wordCount: 5,
    separator: 'dash',
    capitalize: 'first',
    includeNumbers: true,
  };
}

/**
 * Generate memorable pattern-based passphrase
 * Example: "Tiger4Jumps3Over2Moon"
 */
export function generateMemorablePassphrase(length: 'short' | 'medium' | 'long'): GeneratedPassword {
  const wordCounts = {
    short: 4,
    medium: 5,
    long: 6,
  };

  const wordCount = wordCounts[length];

  const options: PassphraseOptions = {
    wordCount,
    separator: 'none',
    capitalize: 'all',
    includeNumbers: true,
  };

  return generatePassphrase(options);
}
