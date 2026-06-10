'use strict';

/* eslint-disable */
/**
 * Build-time search index generator.
 *
 * Emits a single /flatpaper-search.json with { title, url, date, text } per
 * post, fetched lazily by main.js when the search panel first opens. This
 * replaces the old approach of inlining the full index into every page via
 * _partial/search.ejs, which cost O(pages x posts) strip_html calls per
 * `hexo generate` and bloated every page's HTML.
 *
 * Honors `theme.search.limit` (0 / unset = all posts), same as the old inline
 * index did.
 */

const INDEX_PATH = 'flatpaper-search.json';

hexo.extend.generator.register('flatpaper_search_index', function (locals) {
  const searchConfig = (this.theme.config && this.theme.config.search) || {};
  const limit = typeof searchConfig.limit === 'number' ? searchConfig.limit : 0;

  // Same building blocks the template used: Hexo registers these helpers from
  // hexo-util, which isn't directly require()-able from theme scripts under
  // pnpm's strict node_modules layout.
  const stripHtml = this.extend.helper.get('strip_html');
  const urlFor = this.extend.helper.get('url_for').bind(this);

  let posts = locals.posts.sort('date', -1).toArray();
  if (limit > 0) posts = posts.slice(0, limit);

  const index = posts.map(function (post) {
    return {
      title: post.title || 'Untitled',
      url: urlFor(post.path),
      date: post.date && post.date.format ? post.date.format('YYYY-MM-DD') : '',
      text: stripHtml(String(post.excerpt || post.content || ''))
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200)
    };
  });

  return {
    path: INDEX_PATH,
    data: JSON.stringify(index)
  };
});
