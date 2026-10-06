import { describe, expect, it } from 'vitest';

import { dataIssues } from './dataIssues';
import { apiContainer, container, heading, list, listItem, text } from '../elements';
import { authorSpace } from '../index';

const { schema } = authorSpace({
  name: 'Pricing',
  permanentUrl: 'pricing',
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [
        apiContainer({
          id: 'landing',
          query: '/data/landing.json',
          children: [
            heading({ id: 'title', from: 'landing.data.hero.title' }),
            text({ id: 'badge', from: 'landing.data.hero.badge' }),
            list({
              id: 'plan-list',
              items: 'landing.data.plans',
              children: [listItem({ children: [text({ from: 'plan-list.item.name' })] })]
            })
          ]
        })
      ]
    }
  ]
});

const answered = (data: unknown) => ({
  apiContainer_landing: { status: 200, data, isLoading: false, isEmpty: false, hasError: false }
});

describe('dataIssues', () => {
  it('finds nothing wrong on a page whose bindings read what the answer holds, and counts each list’s rows', () => {
    const report = dataIssues(
      schema,
      'home',
      answered({ hero: { title: 'Hi' }, plans: [{ name: 'A' }, { name: 'B' }] })
    );

    expect(report).toEqual({ issues: [], lists: { 'plan-list': 2 } });
  });

  it('names the binding, the path and the keys there are when the answer has no such branch', () => {
    const report = dataIssues(schema, 'home', answered({ plans: [], compare: {}, faq: [] }));

    expect(report.lists).toEqual({ 'plan-list': 0 });
    expect(report.issues.map(issue => issue.elementId)).toEqual(['title', 'badge']);
    expect(report.issues[0]).toEqual({
      code: 'binding-reads-nothing',
      message:
        'heading "title" reads apiContainer_landing.data.hero.title for its content, and the answer has no such path — apiContainer_landing.data has plans, compare, faq',
      elementId: 'title'
    });
  });

  it('says a list reads nothing, whatever step is missing — a list’s rows are never optional', () => {
    const report = dataIssues(schema, 'home', answered({ hero: { title: 'Hi' } }));

    expect(report.lists).toEqual({ 'plan-list': null });
    expect(report.issues.map(issue => issue.elementId)).toEqual(['plan-list']);
  });

  it('leaves a field some answers do not carry alone — the badge is written to be optional', () => {
    const report = dataIssues(schema, 'home', answered({ hero: { title: 'Hi' }, plans: [] }));

    expect(report.issues).toEqual([]);
  });

  it('says once that a provider failed, and judges nothing still on its way', () => {
    expect(
      dataIssues(schema, 'home', { apiContainer_landing: { status: 404, data: 'Not found', isLoading: false } }).issues
    ).toEqual([
      {
        code: 'provider-failed',
        message: 'apiContainer_landing failed — it answered 404 — so everything bound to it is empty',
        elementId: 'landing'
      }
    ]);
    expect(dataIssues(schema, 'home', { apiContainer_landing: { isLoading: true } })).toEqual({
      issues: [],
      lists: {}
    });
  });

  describe('an element the page is not showing', () => {
    const post = authorSpace({
      name: 'Blog',
      permanentUrl: 'blog',
      pages: [
        {
          id: 'post',
          name: 'Post',
          slug: 'post',
          body: [
            apiContainer({
              id: 'article',
              query: '/data/post.json',
              children: [
                container({
                  id: 'article-body',
                  visible: 'article.data.meta.found',
                  loadStrategy: 'visible',
                  children: [
                    heading({ id: 'article-title', from: 'article.data.post.title' }),
                    list({
                      id: 'article-tags',
                      items: 'article.data.post.tags',
                      children: [listItem({ children: [text({ from: 'article-tags.item.name' })] })]
                    })
                  ]
                })
              ]
            })
          ]
        }
      ]
    }).schema;
    const missing = {
      apiContainer_article: { status: 200, data: { meta: { found: false } }, isLoading: false, hasError: false }
    };

    it('reads what is inside it as unmounted — nothing there is said, and no list of it is counted', () => {
      expect(dataIssues(post, 'post', missing, { hidden: new Set(['article-body']) })).toEqual({
        issues: [],
        lists: {}
      });
    });

    it('still holds its own condition against the answer', () => {
      const report = dataIssues(
        post,
        'post',
        { apiContainer_article: { status: 200, data: { post: {} }, isLoading: false, hasError: false } },
        { hidden: new Set(['article-body']) }
      );

      expect(report.issues.map(issue => [issue.elementId, issue.code])).toEqual([
        ['article-body', 'binding-reads-nothing']
      ]);
    });

    it('reads everything when nothing is said to be hidden', () => {
      expect(dataIssues(post, 'post', missing).issues.map(issue => issue.elementId)).toEqual([
        'article-title',
        'article-tags'
      ]);
    });
  });
});
