import { describe, expect, it } from 'vitest';

import { reportTexts } from '.';
import { leftToCheck, privateIn, scrubbed } from './privacy';
import { reportTemplate } from './template';

import type { PrivateWords } from './privacy';

const words: PrivateWords = {
  names: ['nimbo'],
  person: ['ana', 'ana@acme.dev'],
  elements: ['plan-card-root', 'heroTitle'],
  tasks: ['t-plan-card', 't-shell']
};

// A report to Plitzi carries nothing of the person nor of the project — and says so before one that must.
describe('a report to Plitzi', () => {
  it('writes over what names the person or the project, keeping what Plitzi lays out', () => {
    const text = [
      'ana saw plan-card-root drawn twice in t-plan-card, on nimbo — mail ana@acme.dev or bob@x.io',
      'served at http://127.0.0.1:8300/pricing, published at https://nimbo.example.com/x, docs at https://docs.plitzi.com/reference',
      'src/space/pages/home/features/cell.ts imports src/plugins/VzOrbit/declaration.ts and src/space/index.ts; IP 10.0.0.7',
      't-shell is not t-shell-2, and heroTitle not hero',
      'cd ~/htdocs/acme/nim and /Users/ana/work/acme/src/x.ts',
      'class plan-card-root--active in run-copy/src/plugins/Probe/index.ts'
    ].join('\n');

    expect(scrubbed(text, words).split('\n')).toEqual([
      '<person> saw <element> drawn twice in task-1, on <project> — mail <email> or <email>',
      'served at <local url>, published at <url>, docs at https://docs.plitzi.com/reference',
      'src/space/pages/<name>/<name>/<name>.ts imports src/plugins/<name>/declaration.ts and src/space/index.ts; IP <ip>',
      'task-2 is not <task>, and <element> not hero',
      'cd <path> and <path>',
      'class <element>--active in run-copy/src/plugins/<name>/index.ts'
    ]);
  });

  it('lists what it cannot tell by shape — words quoted from a page — never a command or an apostrophe', () => {
    expect(
      leftToCheck(
        "The 404 read 'Página no encontrada', and the agent's note and the lead's said \"facturado anualmente cada año\"; ran 'plitzi page play /x'"
      )
    ).toEqual(['facturado anualmente cada año', 'Página no encontrada']);
  });

  it('names each thing of the person or the project an agent left in its report, but those the person agreed to', () => {
    const found = privateIn(
      'On nimbo, plan-card-root at https://nimbo.example.com reads "Más popular este mes"',
      words,
      ['Más popular este mes']
    );

    expect(found).toEqual([
      'an address: https://nimbo.example.com',
      'the project’s name: nimbo',
      'an element the project named: plan-card-root'
    ]);
  });

  it('reads the report an agent filled off its page — its texts, not its labels — and what was agreed to send', () => {
    const page = reportTemplate({ date: '2026-11-02', cli: '0.0.0', node: 'v24.0.0', os: 'darwin', packages: {} }, [])
      .replace("  title: '',", "  title: 'A defect on nimbo',")
      .replace('  shared: [],', "  shared: ['nimbo'],");
    const read = reportTexts(page);

    expect(read).toMatchObject({ shared: ['nimbo'] });
    expect('texts' in read && read.texts).toContain('A defect on nimbo');
    expect('texts' in read && read.texts).not.toContain('Usage report');
    expect(reportTexts('<html></html>')).toEqual({
      problem: 'it is no page plitzi feedback wrote: its REPORT object is not there'
    });
  });
});
