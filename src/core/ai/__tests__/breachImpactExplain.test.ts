import { describe, it, expect, vi } from 'vitest';
import { buildBreachPrompt, explainBreachImpact } from '../breachImpactExplain';
import * as promptApi from '../promptApi';

vi.mock('../promptApi', () => ({
  runPromptStreaming: vi.fn(),
}));

describe('breachImpactExplain', () => {
  describe('buildBreachPrompt', () => {
    it('constructs a prompt with title and breach data', () => {
      const prompt = buildBreachPrompt({
        credentialTitle: 'My Bank',
        breaches: [
          {
            title: 'ExampleBreach',
            domain: 'example.com',
            breachDate: '2024-01-01',
            pwnCount: 100,
            description: 'A breach occurred.',
            dataClasses: ['Email addresses', 'Passwords', 'Names'],
          },
        ],
      });

      expect(prompt).toContain('Title: My Bank');
      expect(prompt).toContain('Breach Name: ExampleBreach');
      expect(prompt).toContain('Date: 2024-01-01');
      expect(prompt).toContain('Compromised data: Email addresses, Passwords, Names');
    });

    it('includes optional credential metadata', () => {
      const prompt = buildBreachPrompt({
        credentialTitle: 'My Email',
        credentialUsername: 'test@example.com',
        credentialCategory: 'login',
        credentialAgeDays: 450,
        breaches: [],
      });

      expect(prompt).toContain('Username: test@example.com');
      expect(prompt).toContain('Category: login');
      expect(prompt).toContain('Password age: 450 days');
    });

    it('throws if "password: " or "notes: " is found (safety check)', () => {
      expect(() =>
        buildBreachPrompt({
          credentialTitle: 'My Bank',
          credentialUsername: 'password: mysecretpassword',
          breaches: [],
        })
      ).toThrowError(/Safety invariant violation/);
      
      expect(() =>
        buildBreachPrompt({
          credentialTitle: 'My Bank',
          credentialCategory: 'notes: some secret',
          breaches: [],
        })
      ).toThrowError(/Safety invariant violation/);
    });
  });

  describe('explainBreachImpact', () => {
    it('calls runPromptStreaming with the correct arguments', async () => {
      async function* mockStream() {
        yield 'Test ';
        yield 'response';
      }
      vi.mocked(promptApi.runPromptStreaming).mockReturnValue(mockStream());

      const stream = explainBreachImpact({
        credentialTitle: 'Site',
        breaches: [],
      });

      let result = '';
      for await (const chunk of stream) {
        result += chunk;
      }

      expect(result).toBe('Test response');
      expect(promptApi.runPromptStreaming).toHaveBeenCalledWith({
        systemPrompt: expect.stringContaining('You are a security assistant'),
        userPrompt: expect.stringContaining('Title: Site'),
      });
    });
  });
});
