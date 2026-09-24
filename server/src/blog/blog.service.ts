// @ts-nocheck
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { randomUUID } from 'crypto';

@Injectable()
export class BlogService {
  private get db() {
    return this.supabase.getClient();
  }

  constructor(private supabase: SupabaseService) {}

  private normalizeTagName(tag: string) {
    return (tag || '').trim().replace(/^#/, '').toLowerCase();
  }

  private slugifyTag(tag: string) {
    return this.normalizeTagName(tag).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  private async upsertTags(tagNames: string[]) {
    const normalized = Array.from(new Set((tagNames || []).map((t) => this.normalizeTagName(t)).filter(Boolean)));
    if (!normalized.length) return [];

    return Promise.all(
      normalized.map(async (name) => {
        const { data: existing } = await this.db.from('Tag').select('id').eq('name', name).single();
        if (existing) return existing;
        const { data: created } = await this.db.from('Tag').insert({ name, slug: this.slugifyTag(name) }).select('id').single();
        return created;
      }),
    );
  }

  private convertBlocksToHtml(blocks: any[]): string {
    if (!Array.isArray(blocks)) return '';
    return blocks
      .map((block) => {
        const styleStr = block.style
          ? Object.entries(block.style)
              .map(([k, v]) => {
                const cssKey = k.replace(/([A-Z])/g, '-$1').toLowerCase();
                return `${cssKey}: ${v};`;
              })
              .join(' ')
          : '';
        const styleAttr = styleStr ? ` style="${styleStr}"` : '';

        const getLinkAttrs = (targetUrl?: string, inNewTab?: boolean, nofollow?: boolean) => {
          if (!targetUrl) return '';
          const target = inNewTab ? ' target="_blank"' : '';
          const relParts = [];
          if (inNewTab) relParts.push('noopener', 'noreferrer');
          if (nofollow) relParts.push('nofollow');
          const rel = relParts.length ? ` rel="${relParts.join(' ')}"` : '';
          return ` href="${targetUrl}"${target}${rel}`;
        };

        switch (block.type) {
          case 'heading': {
            const linkAttrs = getLinkAttrs(block.url || block.link, block.openInNewTab, block.addNofollow);
            const inner = linkAttrs ? `<a${linkAttrs}>${block.content || ''}</a>` : (block.content || '');
            const rawLvl = Number(block.level || (block.headingType ? block.headingType.replace('h', '') : 2));
            const lvl = Math.min(Math.max(isNaN(rawLvl) ? 2 : rawLvl, 1), 6);
            const headingId = (block.content || `heading-${lvl}`)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '');
            return `<h${lvl} id="${headingId}"${styleAttr}>${inner}</h${lvl}>`;
          }
          case 'text':
            return `<p${styleAttr}>${block.content || ''}</p>`;
          case 'table_of_contents': {
            const tocTitle = block.title || block.tocOptions?.title || 'Table of Contents';
            const headings = blocks
              .filter((b) => b.type === 'heading' && b.content?.trim())
              .map((b) => {
                const rawLvl = Number(b.level || (b.headingType ? b.headingType.replace('h', '') : 2));
                const lvl = Math.min(Math.max(isNaN(rawLvl) ? 2 : rawLvl, 1), 6);
                const headingId = (b.content || `heading-${lvl}`)
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/(^-|-$)/g, '');
                return { title: b.content, level: lvl, id: headingId };
              });

            const linksHtml = headings.length > 0
              ? headings.map((h, i) => {
                  const paddingLeft = Math.max(0, (h.level - 1) * 12);
                  return `<li style="padding-left: ${paddingLeft}px" class="py-1">
                    <a href="#${h.id}" class="text-indigo-600 hover:text-indigo-800 hover:underline text-sm font-semibold flex items-center gap-1.5">
                      <span class="text-xs text-slate-400 font-mono">${i + 1}.</span>
                      <span>${h.title}</span>
                    </a>
                  </li>`;
                }).join('')
              : '<li class="text-xs text-slate-400 italic">No headings found in article yet</li>';

            return `<nav class="blog-toc my-6 p-5 bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-2xl border border-indigo-100 shadow-xs"${styleAttr}>
              <div class="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
                <span class="material-symbols-outlined text-indigo-600 text-lg">toc</span>
                <span>${tocTitle}</span>
              </div>
              <ul class="space-y-1 list-none pl-0 mb-0">${linksHtml}</ul>
            </nav>`;
          }
          case 'table': {
            const tableData = block.tableData || {
              headers: ['Feature', 'Bank Rate', 'Details'],
              rows: [
                ['Collateral-Free Limit', 'Up to ₹75 Lakhs', 'Instant pre-approval'],
                ['Interest Rate', 'From 8.5% p.a.', 'Tax benefit under 80E'],
                ['Moratorium Period', 'Course + 1 Year', 'Zero payment during study'],
              ],
              hasHeader: true,
              isStriped: true,
            };
            const headers = Array.isArray(tableData.headers) ? tableData.headers : [];
            const rows = Array.isArray(tableData.rows) ? tableData.rows : [];
            const hasHeader = tableData.hasHeader !== false;
            const isStriped = !!tableData.isStriped;

            const headerHtml = hasHeader && headers.length > 0
              ? `<thead class="bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider">
                  <tr>${headers.map((h: string) => `<th class="px-4 py-3 text-left border-b border-slate-200">${h}</th>`).join('')}</tr>
                </thead>`
              : '';

            const rowsHtml = rows.map((row: string[], rIdx: number) => {
              const bgClass = isStriped && rIdx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white';
              const cells = (Array.isArray(row) ? row : []).map((cell: string) => `<td class="px-4 py-3 text-slate-700 text-sm border-b border-slate-200/80">${cell}</td>`).join('');
              return `<tr class="${bgClass} hover:bg-slate-50 transition-colors">${cells}</tr>`;
            }).join('');

            return `<div class="blog-table-wrapper my-6 overflow-x-auto rounded-xl border border-slate-200 shadow-xs"${styleAttr}>
              <table class="min-w-full divide-y divide-slate-200 text-left border-collapse">
                ${headerHtml}
                <tbody class="divide-y divide-slate-100">${rowsHtml}</tbody>
              </table>
            </div>`;
          }
          case 'image': {
            const linkAttrs = getLinkAttrs(block.url || block.link, block.openInNewTab, block.addNofollow);
            const imgTag = `<img src="${block.content || ''}" alt="Blog Image"${styleAttr} />`;
            const inner = linkAttrs ? `<a${linkAttrs}>${imgTag}</a>` : imgTag;
            return `<div class="blog-image-wrapper">${inner}</div>`;
          }
          case 'video': {
            const content = block.content || '';
            const isNativeVideo = content.startsWith('data:video/') || content.startsWith('blob:') || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(content);
            if (isNativeVideo) {
              return `<div class="blog-video-wrapper my-4"><video controls src="${content}" class="w-full rounded-xl"${styleAttr}></video></div>`;
            }
            let embedUrl = content;
            const ytMatch = content.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
            if (ytMatch && ytMatch[1]) {
              embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
            } else {
              const vimeoMatch = content.match(/vimeo\.com\/(?:video\/)?([0-9]+)/i);
              if (vimeoMatch && vimeoMatch[1]) {
                embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
              }
            }
            return `<div class="blog-video-wrapper my-4 aspect-video w-full rounded-xl overflow-hidden shadow-sm"><iframe src="${embedUrl}" class="w-full h-full" frameborder="0" allowfullscreen${styleAttr}></iframe></div>`;
          }
          case 'button': {
            const linkAttrs = getLinkAttrs(block.url || block.link || '#', block.openInNewTab, block.addNofollow);
            return `<div class="blog-button-wrapper"><a${linkAttrs} class="blog-btn"${styleAttr}>${block.content || 'Click Here'}</a></div>`;
          }
          case 'link': {
            const linkAttrs = getLinkAttrs(block.url || block.link || '#', block.openInNewTab, block.addNofollow);
            return `<div class="blog-link-wrapper"><a${linkAttrs} class="blog-link font-bold text-indigo-600 hover:underline"${styleAttr}>${block.content || block.url || 'Learn More'} &rarr;</a></div>`;
          }
          case 'cta': {
            const linkAttrs = getLinkAttrs(block.url || block.link || '#', block.openInNewTab, block.addNofollow);
            return `<div class="blog-cta-card p-6 my-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100"${styleAttr}>
              <h3 class="text-xl font-extrabold text-indigo-950 mb-2">${block.title || 'Ready to Apply?'}</h3>
              <p class="text-sm text-slate-600 mb-4">${block.content || ''}</p>
              <a${linkAttrs} class="inline-block px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md">${block.buttonText || 'Apply Now &rarr;'}</a>
            </div>`;
          }
          case 'alert':
            return `<div class="blog-alert-box p-4 my-4 rounded-xl border border-amber-200 bg-amber-50/80 text-amber-950 text-xs font-semibold"${styleAttr}><strong>${block.title || 'Important'}:</strong> ${block.content || ''}</div>`;
          case 'list': {
            const isOrdered = block.listType === 'ordered';
            const items = (block.items && block.items.length > 0)
              ? block.items.map((it: any) => `<li>${it.title || it.content || it}</li>`).join('')
              : (block.content || '')
                  .split('\n')
                  .filter((s: string) => s.trim().length > 0)
                  .map((item: string) => `<li>${item.replace(/^[•\-\*\d+\.]\s*/, '')}</li>`)
                  .join('');
            return isOrdered ? `<ol${styleAttr}>${items}</ol>` : `<ul${styleAttr}>${items}</ul>`;
          }
          case 'quote':
            return `<blockquote${styleAttr}>${block.content || ''}</blockquote>`;
          case 'code':
            return `<pre${styleAttr}><code>${block.content || ''}</code></pre>`;
          case 'image_box': {
            return `<div class="blog-image-box p-4 my-4 rounded-2xl border border-slate-200"${styleAttr}>${block.url ? `<img src="${block.url}" alt="${block.title || 'Image'}" class="w-full rounded-xl mb-3" />` : ''}<h3 class="text-lg font-bold text-slate-900">${block.title || ''}</h3><p class="text-sm text-slate-600 mt-1">${block.content || ''}</p></div>`;
          }
          case 'testimonial': {
            return `<div class="blog-testimonial p-6 my-4 bg-purple-50/50 border border-purple-100 rounded-2xl"${styleAttr}><div class="text-amber-400 mb-2">★★★★★</div><p class="italic text-slate-700 mb-3">"${block.content || ''}"</p><strong>${block.title || ''}</strong><div class="text-xs text-slate-500">${block.subtitle || ''}</div></div>`;
          }
          case 'icon': {
            return `<div class="blog-icon-box text-center my-4"${styleAttr}><span class="material-symbols-outlined text-4xl text-rose-600">${block.iconName || 'verified'}</span><p class="font-bold text-sm mt-1">${block.title || ''}</p></div>`;
          }
          case 'icon_box': {
            return `<div class="blog-icon-card flex items-start gap-4 p-4 my-4 rounded-xl border border-slate-200"${styleAttr}><span class="material-symbols-outlined text-3xl text-indigo-600 shrink-0">${block.iconName || 'account_balance'}</span><div><h4 class="font-bold text-slate-900">${block.title || ''}</h4><p class="text-sm text-slate-600 mt-1">${block.content || ''}</p></div></div>`;
          }
          case 'social_icons': {
            const links = (block.items || []).map((it: any) => `<a href="${it.url || '#'}" target="_blank" class="px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-700">${it.title}</a>`).join(' ');
            return `<div class="blog-social-links my-4"${styleAttr}><p class="text-xs font-bold mb-2">${block.title || 'Follow Us'}:</p><div class="flex gap-2 flex-wrap">${links}</div></div>`;
          }
          case 'image_gallery': {
            const imgs = (block.items || []).map((it: any) => `<img src="${it.url}" alt="${it.title || 'Gallery'}" class="rounded-xl object-cover w-full h-40" />`).join('');
            return `<div class="blog-gallery grid grid-cols-2 sm:grid-cols-3 gap-3 my-4"${styleAttr}>${imgs}</div>`;
          }
          case 'image_carousel': {
            return `<div class="blog-carousel my-4 rounded-2xl overflow-hidden shadow-sm"${styleAttr}>${block.items?.[0] ? `<img src="${block.items[0].url}" alt="Carousel" class="w-full h-64 object-cover" /><div class="p-3 bg-slate-900 text-white"><p class="font-bold text-sm">${block.items[0].title || ''}</p><p class="text-xs text-slate-300">${block.items[0].content || ''}</p></div>` : ''}</div>`;
          }
          case 'icon_list': {
            const listItems = (block.items || []).map((it: any) => `<li class="flex items-center gap-2 text-sm text-slate-700"><span class="text-emerald-600 font-bold">✓</span><span>${it.title}</span></li>`).join('');
            return `<div class="blog-icon-list my-4"${styleAttr}><p class="font-bold text-xs mb-2">${block.title || 'Highlights'}:</p><ul class="space-y-1.5 list-none pl-0">${listItems}</ul></div>`;
          }
          case 'counter': {
            return `<div class="blog-counter text-center p-6 my-4 bg-slate-50 rounded-2xl border border-slate-200"${styleAttr}><div class="text-4xl font-extrabold text-indigo-600 font-mono">${block.prefix || ''}${block.value || ''}${block.suffix || ''}</div><p class="text-sm font-semibold text-slate-700 mt-1">${block.title || ''}</p></div>`;
          }
          case 'progress_bar': {
            return `<div class="blog-progress my-4 p-4 rounded-xl border border-slate-100"${styleAttr}><div class="flex justify-between text-xs font-bold mb-1"><span>${block.title || ''}</span><span>${block.value || 94}%</span></div><div class="w-full bg-slate-200 rounded-full h-3"><div class="bg-indigo-600 h-3 rounded-full" style="width: ${block.value || 94}%"></div></div></div>`;
          }
          case 'nested_tabs': {
            const tabsHtml = (block.items || []).map((t: any) => `<div class="my-2 p-3 bg-slate-50 rounded-xl"><strong class="text-xs text-indigo-600">${t.title}:</strong> <span class="text-xs text-slate-700">${t.content || ''}</span></div>`).join('');
            return `<div class="blog-tabs my-4 border border-slate-200 rounded-2xl p-4"${styleAttr}><h4 class="font-bold text-sm mb-2">${block.title || ''}</h4>${tabsHtml}</div>`;
          }
          case 'nested_accordion': {
            const accHtml = (block.items || []).map((a: any) => `<details class="border border-slate-200 rounded-xl p-3 bg-slate-50 my-1.5"><summary class="font-bold text-xs cursor-pointer text-slate-800">${a.title}</summary><div class="pt-2 text-xs text-slate-600">${a.content || ''}</div></details>`).join('');
            return `<div class="blog-accordion my-4"${styleAttr}><h4 class="font-bold text-sm mb-2">${block.title || ''}</h4>${accHtml}</div>`;
          }
          case 'rating': {
            return `<div class="blog-rating text-center p-4 my-4 bg-amber-50/50 rounded-2xl border border-amber-200"${styleAttr}><div class="text-amber-500 text-xl font-bold">★ ★ ★ ★ ★</div><p class="font-bold text-sm text-slate-800">${block.title || '4.9 / 5 Rating'}</p><p class="text-xs text-slate-500">${block.subtitle || ''}</p></div>`;
          }
          case 'html': {
            return block.content || '';
          }
          case 'shortcode': {
            return `<div class="blog-shortcode my-4 p-3 bg-slate-100 border border-slate-300 rounded-xl font-mono text-xs text-slate-700">${block.content || ''}</div>`;
          }
          case 'menu_anchor': {
            return `<a id="${block.content || 'anchor'}" class="blog-anchor"></a>`;
          }
          case 'read_more': {
            return `<!--more-->`;
          }
          case 'sidebar': {
            return `<div class="blog-sidebar-callout p-4 my-4 bg-slate-50 border border-slate-200 rounded-xl"${styleAttr}><h4 class="font-bold text-xs text-indigo-600 uppercase mb-1">${block.title || 'Sidebar'}</h4><p class="text-xs text-slate-600">${block.content || ''}</p></div>`;
          }
          case 'google_maps': {
            return `<div class="blog-map my-4 rounded-xl overflow-hidden aspect-video border border-slate-200"${styleAttr}><iframe src="https://maps.google.com/maps?q=${encodeURIComponent(block.content || 'London')}&t=&z=13&ie=UTF8&iwloc=&output=embed" class="w-full h-full border-0"></iframe></div>`;
          }
          case 'soundcloud': {
            return `<div class="blog-audio my-4 p-4 bg-orange-50 border border-orange-200 rounded-xl"${styleAttr}><p class="font-bold text-xs text-orange-700">${block.title || 'SoundCloud Audio'}</p><audio controls src="${block.content || ''}" class="w-full mt-2"></audio></div>`;
          }
          case 'text_path': {
            return `<div class="blog-text-path my-4 text-center text-sm font-bold tracking-widest text-indigo-700"${styleAttr}>${block.title || block.content || ''}</div>`;
          }
          case 'link_bio': {
            const bioLinks = (block.items || []).map((it: any) => `<a href="${it.url || '/apply'}" class="block py-2.5 px-4 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-indigo-700 shadow-xs mb-2">${it.title}</a>`).join('');
            return `<div class="blog-link-in-bio my-6 p-6 bg-gradient-to-b from-indigo-50 to-purple-50 rounded-3xl text-center max-w-md mx-auto border border-indigo-200"${styleAttr}><h3 class="font-extrabold text-lg text-slate-900 mb-1">${block.title || ''}</h3><p class="text-xs text-slate-500 mb-4">${block.subtitle || ''}</p><div>${bioLinks}</div></div>`;
          }
          case 'divider':
            return `<hr${styleAttr} />`;
          case 'spacer':
            return `<div class="blog-spacer"${styleAttr}></div>`;
          default:
            return `<div${styleAttr}>${block.content || ''}</div>`;
        }
      })
      .join('\n');
  }

  private mapTags(blog: any) {
    if (!blog) return blog;
    const mapped = {
      ...blog,
      tags: (blog.tags || []).map((t: any) => (t.tag ? t.tag.name : t.name || t)),
    };

    // Parse blocks from content metadata comment
    const content = blog.content || '';
    const match = content.match(/<!--BLOCKS_JSON_START-->([\s\S]*?)<!--BLOCKS_JSON_END-->/);
    if (match) {
      try {
        mapped.blocks = JSON.parse(match[1]);
        mapped.content = content.replace(/<!--BLOCKS_JSON_START-->[\s\S]*?<!--BLOCKS_JSON_END-->/, '').trim();
      } catch (e) {
        mapped.blocks = [];
      }
    } else {
      mapped.blocks = [];
    }

    // Set subtitle/coverImage for compatibility with IT dashboard
    mapped.subtitle = blog.excerpt || '';
    mapped.coverImage = blog.featuredImage || '';

    return mapped;
  }

  async getAllBlogs(options?: { category?: string; featured?: boolean; limit?: number; offset?: number }) {
    const { category, featured, limit = 10, offset = 0 } = options || {};

    let query = this.db
      .from('Blog')
      .select('id, title, slug, excerpt, content, category, authorName, authorImage, authorRole, featuredImage, readTime, views, isFeatured, isPublished, publishedAt, createdAt, tags:BlogTag(tag:Tag(name))', { count: 'exact' })
      .order('isFeatured', { ascending: false })
      .order('publishedAt', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) query = query.eq('category', category);
    if (featured !== undefined) query = query.eq('isFeatured', featured);

    const { data: blogs, count } = await query;
    return {
      success: true,
      data: (blogs || []).map((b) => this.mapTags(b)),
      pagination: { total: count || 0, limit, offset, hasMore: offset + (blogs?.length || 0) < (count || 0) },
    };
  }

  async getFeaturedBlog() {
    const { data: blog } = await this.db
      .from('Blog')
      .select('id, title, slug, excerpt, category, authorName, authorImage, authorRole, featuredImage, readTime, views, publishedAt, tags:BlogTag(tag:Tag(name))')
      .eq('isPublished', true)
      .eq('isFeatured', true)
      .order('publishedAt', { ascending: false })
      .limit(1)
      .single();

    if (!blog) return { success: false, message: 'No featured blog found', data: null };
    return { success: true, data: this.mapTags(blog) };
  }

  async getBlogBySlug(slug: string) {
    const { data: blog } = await this.db
      .from('Blog')
      .select('id, title, slug, excerpt, content, category, authorName, authorImage, authorRole, featuredImage, readTime, views, publishedAt, createdAt, updatedAt, tags:BlogTag(tag:Tag(name)), comments:Comment(id, author, content, createdAt)')
      .eq('slug', slug)
      .single();

    if (!blog) throw new NotFoundException('Blog not found');

    // Increment view count (fire-and-forget)
    this.db.from('Blog').update({ views: (blog.views || 0) + 1 }).eq('slug', slug).then(() => {});

    return { success: true, data: this.mapTags(blog) };
  }

  async getBlogById(id: string) {
    const { data: blog } = await this.db
      .from('Blog')
      .select('id, title, slug, excerpt, content, category, authorName, authorImage, authorRole, featuredImage, readTime, views, isFeatured, isPublished, publishedAt, createdAt, updatedAt, tags:BlogTag(tag:Tag(name))')
      .eq('id', id)
      .single();

    if (!blog) throw new NotFoundException('Blog not found');
    return { success: true, data: this.mapTags(blog) };
  }

  async getPopularBlogs(limit = 10) {
    const { data: blogs } = await this.db
      .from('Blog')
      .select('id, title, slug, excerpt, category, authorName, authorImage, featuredImage, readTime, views, publishedAt, tags:BlogTag(tag:Tag(name))')
      .eq('isPublished', true)
      .order('views', { ascending: false })
      .limit(limit);
    return { success: true, data: (blogs || []).map((b) => this.mapTags(b)) };
  }

  async getBlogStats(id: string) {
    const { data: blog } = await this.db
      .from('Blog')
      .select('id, title, slug, views, category, publishedAt, createdAt, updatedAt, isFeatured, isPublished')
      .eq('id', id)
      .single();

    if (!blog) throw new NotFoundException('Blog not found');
    return {
      success: true,
      data: {
        ...blog,
        daysSincePublished: blog.publishedAt
          ? Math.floor((Date.now() - new Date(blog.publishedAt).getTime()) / (1000 * 60 * 60 * 24))
          : null,
      },
    };
  }

  async incrementBlogView(id: string) {
    const { data: blog } = await this.db.from('Blog').select('views').eq('id', id).single();
    if (!blog) throw new NotFoundException('Blog not found');
    const { data: updated } = await this.db.from('Blog').update({ views: (blog.views || 0) + 1 }).eq('id', id).select('views').single();
    return { success: true, views: updated?.views };
  }

  async getCategories() {
    const { data: blogs } = await this.db.from('Blog').select('category').eq('isPublished', true);
    const counts: Record<string, number> = {};
    for (const b of blogs || []) {
      counts[b.category] = (counts[b.category] || 0) + 1;
    }
    return { success: true, data: Object.entries(counts).map(([name, count]) => ({ name, count })) };
  }

  async getRelatedBlogs(category: string, excludeSlug: string, limit = 3) {
    const { data: blogs } = await this.db
      .from('Blog')
      .select('id, title, slug, excerpt, category, featuredImage, readTime, publishedAt, tags:BlogTag(tag:Tag(name))')
      .eq('isPublished', true)
      .eq('category', category)
      .neq('slug', excludeSlug)
      .order('publishedAt', { ascending: false })
      .limit(limit);
    return { success: true, data: (blogs || []).map((b) => this.mapTags(b)) };
  }

  async createBlog(data: any) {
    const dbData: any = {};
    const now = new Date().toISOString();
    dbData.id = randomUUID();       // @default(uuid()) is Prisma-only — Supabase JS needs it supplied
    dbData.createdAt = now;         // @default(now()) is Prisma-only — must supply
    dbData.updatedAt = now;         // @updatedAt is Prisma-only — must supply
    dbData.title = data.title || 'Untitled Article';

    // Ensure slug is uniquely available
    let baseSlug = (data.slug || data.title || 'article')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    if (!baseSlug) baseSlug = `article-${Date.now()}`;

    let candidateSlug = baseSlug;
    let counter = 1;
    while (true) {
      const { data: existing } = await this.db.from('Blog').select('id').eq('slug', candidateSlug).maybeSingle();
      if (!existing) break;
      candidateSlug = `${baseSlug}-${counter}`;
      counter++;
    }
    dbData.slug = candidateSlug;

    dbData.category = data.category || 'Loan Guidance';
    dbData.authorName = data.authorName || 'IT Staff';

    // Safely check authorId: must exist in User table else set to null to avoid foreign key failure
    if (data.authorId) {
      try {
        const { data: userExists } = await this.db
          .from('User')
          .select('id')
          .eq('id', data.authorId)
          .maybeSingle();
        dbData.authorId = userExists?.id || null;
      } catch {
        dbData.authorId = null;
      }
    } else {
      dbData.authorId = null;
    }

    dbData.authorImage = data.authorImage || null;
    dbData.authorRole = data.authorRole || null;
    dbData.readTime = data.readTime !== undefined ? data.readTime : 5;
    dbData.isFeatured = !!data.isFeatured;
    
    // Map published to isPublished
    const isPub = data.published !== undefined ? !!data.published : (data.isPublished !== undefined ? !!data.isPublished : false);
    dbData.isPublished = isPub;
    dbData.status = isPub ? 'published' : 'draft';
    dbData.visibility = isPub ? 'public' : 'private';
    dbData.publishedAt = isPub ? new Date().toISOString() : null;

    // Map coverImage to featuredImage
    dbData.featuredImage = data.coverImage || data.featuredImage || '';

    // Map subtitle to excerpt, guarantee non-empty
    dbData.excerpt = (data.excerpt || data.subtitle || data.title || 'Educational loan guide').trim();
    if (!dbData.excerpt) dbData.excerpt = 'Educational loan guidance article';

    // Map blocks/content
    let htmlContent = '';
    let blocksArr = [];
    if (data.blocks) {
      blocksArr = data.blocks;
      htmlContent = this.convertBlocksToHtml(blocksArr);
    } else {
      htmlContent = data.content || '';
    }

    // Append metadata blocks JSON
    dbData.content = `${htmlContent}\n\n<!--BLOCKS_JSON_START-->${JSON.stringify(blocksArr)}<!--BLOCKS_JSON_END-->`;

    const { tags = [] } = data;
    const { data: blog, error } = await this.db
      .from('Blog')
      .insert(dbData)
      .select('id, title, slug, excerpt, content, category, authorName, authorImage, authorRole, featuredImage, readTime, isFeatured, isPublished, publishedAt, createdAt')
      .single();

    if (error) {
      console.error('Supabase Blog Insert Error:', error);
      throw new BadRequestException(error.message || 'Failed to create blog');
    }

    if (tags.length > 0) {
      const tagRecords = await this.upsertTags(tags);
      await this.db.from('BlogTag').insert(tagRecords.filter(Boolean).map((t) => ({ blogId: blog.id, tagId: t.id })));
    }

    const { data: finalBlog } = await this.db
      .from('Blog')
      .select('*, tags:BlogTag(tag:Tag(name))')
      .eq('id', blog.id)
      .single();

    return { success: true, message: 'Blog created successfully', data: this.mapTags(finalBlog) };
  }

  async updateBlog(id: string, data: any) {
    const { data: existingBlog } = await this.db.from('Blog').select('id, publishedAt, content, slug').eq('id', id).single();
    if (!existingBlog) throw new NotFoundException('Blog not found');

    const dbData: any = {};
    if (data.title !== undefined) dbData.title = data.title;
    
    // Ensure slug is uniquely available if changed
    if (data.slug !== undefined && data.slug !== existingBlog.slug) {
      let baseSlug = (data.slug || data.title || 'article')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      if (!baseSlug) baseSlug = `article-${Date.now()}`;

      let candidateSlug = baseSlug;
      let counter = 1;
      while (true) {
        const { data: existing } = await this.db
          .from('Blog')
          .select('id')
          .eq('slug', candidateSlug)
          .neq('id', id)
          .maybeSingle();
        if (!existing) break;
        candidateSlug = `${baseSlug}-${counter}`;
        counter++;
      }
      dbData.slug = candidateSlug;
    }

    if (data.category !== undefined) dbData.category = data.category;
    if (data.authorName !== undefined) dbData.authorName = data.authorName;

    // Safely check authorId: must exist in User table else set to null
    if (data.authorId !== undefined) {
      if (data.authorId) {
        try {
          const { data: userExists } = await this.db
            .from('User')
            .select('id')
            .eq('id', data.authorId)
            .maybeSingle();
          dbData.authorId = userExists?.id || null;
        } catch {
          dbData.authorId = null;
        }
      } else {
        dbData.authorId = null;
      }
    }

    if (data.authorImage !== undefined) dbData.authorImage = data.authorImage;
    if (data.authorRole !== undefined) dbData.authorRole = data.authorRole;
    if (data.readTime !== undefined) dbData.readTime = data.readTime;
    if (data.isFeatured !== undefined) dbData.isFeatured = !!data.isFeatured;

    // Map published to isPublished
    if (data.published !== undefined || data.isPublished !== undefined) {
      const isPublished = data.published !== undefined ? !!data.published : !!data.isPublished;
      dbData.isPublished = isPublished;
      dbData.status = isPublished ? 'published' : 'draft';
      dbData.visibility = isPublished ? 'public' : 'private';
      if (isPublished && !existingBlog.publishedAt) {
        dbData.publishedAt = new Date().toISOString();
      } else if (!isPublished) {
        dbData.publishedAt = null;
      }
    }

    // Map coverImage to featuredImage
    if (data.coverImage !== undefined || data.featuredImage !== undefined) {
      dbData.featuredImage = data.coverImage !== undefined ? data.coverImage : data.featuredImage;
    }

    // Map subtitle to excerpt
    if (data.subtitle !== undefined || data.excerpt !== undefined) {
      dbData.excerpt = (data.excerpt !== undefined ? data.excerpt : data.subtitle) || 'Educational loan guide';
    }

    // Map blocks/content
    if (data.blocks !== undefined || data.content !== undefined) {
      let htmlContent = '';
      let blocksArr = [];
      if (data.blocks !== undefined) {
        blocksArr = data.blocks;
        htmlContent = this.convertBlocksToHtml(blocksArr);
      } else {
        htmlContent = data.content || '';
      }
      dbData.content = `${htmlContent}\n\n<!--BLOCKS_JSON_START-->${JSON.stringify(blocksArr)}<!--BLOCKS_JSON_END-->`;
    }

    dbData.updatedAt = new Date().toISOString(); // @updatedAt is Prisma-only — must set manually for Supabase JS client

    const { error: updateError } = await this.db.from('Blog').update(dbData).eq('id', id);
    if (updateError) {
      console.error('Supabase Blog Update Error:', updateError);
      throw new BadRequestException(updateError.message || 'Failed to update blog');
    }

    const { tags } = data;
    if (tags !== undefined) {
      const tagRecords = await this.upsertTags(tags);
      await this.db.from('BlogTag').delete().eq('blogId', id);
      if (tagRecords.length) {
        await this.db.from('BlogTag').insert(tagRecords.filter(Boolean).map((t) => ({ blogId: id, tagId: t.id })));
      }
    }

    const { data: blog } = await this.db.from('Blog').select('*, tags:BlogTag(tag:Tag(name))').eq('id', id).single();
    return { success: true, message: 'Blog updated successfully', data: this.mapTags(blog) };
  }

  async deleteBlog(id: string) {
    const { data: blog } = await this.db.from('Blog').select('id').eq('id', id).single();
    if (!blog) throw new NotFoundException('Blog not found');
    await this.db.from('Blog').delete().eq('id', id);
    return { success: true, message: 'Blog deleted successfully' };
  }

  async searchBlogs(query: string, limit = 10) {
    const { data: blogs } = await this.db
      .from('Blog')
      .select('id, title, slug, excerpt, category, featuredImage, readTime, publishedAt, tags:BlogTag(tag:Tag(name))')
      .eq('isPublished', true)
      .or(`title.ilike.%${query}%,excerpt.ilike.%${query}%,content.ilike.%${query}%`)
      .order('publishedAt', { ascending: false })
      .limit(limit);
    return { success: true, data: (blogs || []).map((b) => this.mapTags(b)), count: blogs?.length || 0 };
  }

  async getAllTags(limit?: number) {
    const { data: tags } = await this.db
      .from('Tag')
      .select('id, name, slug, blogs:BlogTag(blogId, blog:Blog(isPublished))')
      .order('name', { ascending: true });

    let tagsWithCount = (tags || [])
      .map((tag: any) => ({
        name: tag.name,
        slug: tag.slug,
        count: (tag.blogs || []).filter((b: any) => b.blog?.isPublished).length,
      }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count);

    if (limit) tagsWithCount = tagsWithCount.slice(0, limit);
    return { success: true, data: tagsWithCount };
  }

  async searchBlogsByTag(tag: string, limit = 10, offset = 0) {
    const normalizedTag = this.normalizeTagName(tag);
    if (!normalizedTag) return { success: true, data: [], count: 0, pagination: { total: 0, limit, offset, hasMore: false } };

    // Get all blogs with the tag via junction table
    const { data: tagRecord } = await this.db.from('Tag').select('id').eq('name', normalizedTag).single();
    if (!tagRecord) return { success: true, data: [], count: 0, pagination: { total: 0, limit, offset, hasMore: false } };

    const { data: blogTags } = await this.db.from('BlogTag').select('blogId').eq('tagId', tagRecord.id);
    const blogIds = (blogTags || []).map((bt: any) => bt.blogId);
    if (!blogIds.length) return { success: true, data: [], count: 0, pagination: { total: 0, limit, offset, hasMore: false } };

    const { data: blogs, count } = await this.db
      .from('Blog')
      .select('id, title, slug, excerpt, category, featuredImage, readTime, publishedAt, tags:BlogTag(tag:Tag(name))', { count: 'exact' })
      .eq('isPublished', true)
      .in('id', blogIds)
      .order('publishedAt', { ascending: false })
      .range(offset, offset + limit - 1);

    return {
      success: true,
      data: (blogs || []).map((b) => this.mapTags(b)),
      count: count || 0,
      pagination: { total: count || 0, limit, offset, hasMore: offset + (blogs?.length || 0) < (count || 0) },
    };
  }

  async addCommentToBlog(blogId: string, data: { author: string; content: string }) {
    const { data: blog } = await this.db.from('Blog').select('id').eq('id', blogId).single();
    if (!blog) throw new NotFoundException('Blog not found');

    const { data: comment, error } = await this.db
      .from('Comment')
      .insert({ blogId, author: data.author, content: data.content })
      .select('id, author, content, createdAt')
      .single();

    if (error) throw error;
    return { success: true, message: 'Comment added successfully', data: comment };
  }

  async addReplyToComment(commentId: string, data: { author: string; content: string }) {
    const { data: parent } = await this.db.from('Comment').select('id, blogId').eq('id', commentId).single();
    if (!parent) throw new NotFoundException('Comment not found');

    const { data: reply, error } = await this.db
      .from('Comment')
      .insert({ blogId: parent.blogId, parentId: commentId, author: data.author, content: data.content })
      .select('id, author, content, likes, createdAt')
      .single();

    if (error) throw error;
    return { success: true, message: 'Reply added successfully', data: reply };
  }

  async deleteComment(commentId: string) {
    const { data: comment } = await this.db.from('Comment').select('id').eq('id', commentId).single();
    if (!comment) throw new NotFoundException('Comment not found');

    // Delete likes and replies first, then the comment
    await this.db.from('CommentLike').delete().eq('commentId', commentId);
    await this.db.from('Comment').delete().eq('parentId', commentId);
    await this.db.from('Comment').delete().eq('id', commentId);

    return { success: true, message: 'Comment deleted successfully' };
  }

  async toggleCommentLike(commentId: string, userId: string) {
    const { data: comment } = await this.db.from('Comment').select('id, likes').eq('id', commentId).single();
    if (!comment) throw new NotFoundException('Comment not found');

    const { data: existing } = await this.db
      .from('CommentLike')
      .select('id')
      .eq('commentId', commentId)
      .eq('userId', userId)
      .single();

    const currentLikes = comment.likes || 0;

    if (existing) {
      await this.db.from('CommentLike').delete().eq('id', existing.id);
      await this.db.from('Comment').update({ likes: Math.max(0, currentLikes - 1) }).eq('id', commentId);
      return { success: true, message: 'Comment unliked', liked: false, likesCount: Math.max(0, currentLikes - 1) };
    } else {
      await this.db.from('CommentLike').insert({ commentId, userId });
      await this.db.from('Comment').update({ likes: currentLikes + 1 }).eq('id', commentId);
      return { success: true, message: 'Comment liked', liked: true, likesCount: currentLikes + 1 };
    }
  }

  async getCommentsForBlog(blogId: string, limit = 20, offset = 0) {
    const { data: blog } = await this.db.from('Blog').select('id').eq('id', blogId).single();
    if (!blog) throw new NotFoundException('Blog not found');

    const { data: comments, count } = await this.db
      .from('Comment')
      .select('id, author, content, likes, createdAt, replies:Comment!parentId(id, author, content, likes, createdAt)', { count: 'exact' })
      .eq('blogId', blogId)
      .is('parentId', null)
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);

    const total = count || 0;
    return {
      success: true,
      data: comments || [],
      pagination: { total, limit, offset, hasMore: offset + (comments?.length || 0) < total },
    };
  }

  // ==================== ADMIN METHODS ====================

  async getAllBlogsAdmin(options?: { limit?: number; offset?: number; status?: string; timeRange?: string }) {
    const { limit = 50, offset = 0, status, timeRange } = options || {};

    let query = this.db
      .from('Blog')
      .select('id, title, slug, excerpt, content, category, authorName, authorImage, authorRole, featuredImage, readTime, views, isFeatured, isPublished, publishedAt, createdAt, updatedAt, tags:BlogTag(tag:Tag(name))', { count: 'exact' })
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status === 'published') query = query.eq('isPublished', true);
    if (status === 'draft') query = query.eq('isPublished', false);

    if (timeRange && timeRange !== 'all') {
      const now = new Date();
      let fromDate: Date;
      if (timeRange === 'today') fromDate = new Date(now.setHours(0, 0, 0, 0));
      else if (timeRange === 'week') fromDate = new Date(now.setDate(now.getDate() - 7));
      else if (timeRange === 'month') fromDate = new Date(now.setMonth(now.getMonth() - 1));
      else if (timeRange === 'year') fromDate = new Date(now.setFullYear(now.getFullYear() - 1));
      
      if (fromDate) {
        query = query.gte('createdAt', fromDate.toISOString());
      }
    }

    const { data: blogs, count } = await query;

    return {
      success: true,
      data: (blogs || []).map((b) => this.mapTags(b)),
      pagination: { total: count || 0, limit, offset, hasMore: offset + (blogs?.length || 0) < (count || 0) },
    };
  }

  async getBlogStatistics() {
    try {
      const { data: blogs } = await this.db
        .from('Blog')
        .select('isPublished, isFeatured, views');

      const all = blogs || [];
      const total = all.length;
      const published = all.filter((b: any) => b.isPublished).length;
      const draft = all.filter((b: any) => !b.isPublished).length;
      const featured = all.filter((b: any) => b.isFeatured && b.isPublished).length;
      const totalViews = all.reduce((sum: number, b: any) => sum + (b.views || 0), 0);

      return { success: true, data: { total, published, draft, featured, totalViews } };
    } catch (e) {
      console.error('[getBlogStatistics] Exception:', e);
      return { success: true, data: { total: 0, published: 0, draft: 0, featured: 0, totalViews: 0 } };
    }
  }

  async bulkDeleteBlogs(blogIds: string[]) {
    if (!blogIds || blogIds.length === 0) return { success: false, message: 'No blog IDs provided' };
    const { error } = await this.db.from('Blog').delete().in('id', blogIds);
    if (error) throw error;
    return { success: true, message: `${blogIds.length} blog(s) deleted successfully`, deleted: blogIds.length };
  }

  async bulkUpdateStatus(blogIds: string[], isPublished: boolean) {
    if (!blogIds || blogIds.length === 0) return { success: false, message: 'No blog IDs provided' };

    const updateData: any = { isPublished };
    if (isPublished) {
      // Set publishedAt only for blogs that don't have it yet
      const { data: withoutDate } = await this.db.from('Blog').select('id').in('id', blogIds).is('publishedAt', null);
      const withoutDateIds = (withoutDate || []).map((b: any) => b.id);
      if (withoutDateIds.length) {
        await this.db.from('Blog').update({ isPublished: true, publishedAt: new Date().toISOString() }).in('id', withoutDateIds);
      }
      const withDateIds = blogIds.filter((id) => !withoutDateIds.includes(id));
      if (withDateIds.length) {
        await this.db.from('Blog').update({ isPublished: true }).in('id', withDateIds);
      }
      return { success: true, message: `${blogIds.length} blog(s) published successfully`, updated: blogIds.length };
    } else {
      await this.db.from('Blog').update({ isPublished: false }).in('id', blogIds);
      return { success: true, message: `${blogIds.length} blog(s) unpublished successfully`, updated: blogIds.length };
    }
  }

  async submitForApproval(blogId: string, notes?: string) {
    const { data: blog } = await this.db.from('Blog').select('id, status').eq('id', blogId).single();
    if (!blog) throw new Error('Blog not found');
    if (blog.status !== 'draft') throw new Error('Only draft blogs can be submitted for approval');
    const { data, error } = await this.db
      .from('Blog')
      .update({ status: 'pending', submittedAt: new Date().toISOString() })
      .eq('id', blogId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async publishBlog(blogId: string, visibility: 'private' | 'public' = 'public') {
    const { data: blog } = await this.db.from('Blog').select('id').eq('id', blogId).single();
    if (!blog) throw new Error('Blog not found');
    const { data, error } = await this.db
      .from('Blog')
      .update({ status: 'published', visibility, isPublished: visibility === 'public', publishedAt: new Date().toISOString() })
      .eq('id', blogId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async unpublishBlog(blogId: string, reason?: string) {
    const { data: blog } = await this.db.from('Blog').select('id, status').eq('id', blogId).single();
    if (!blog) throw new Error('Blog not found');
    if (blog.status !== 'published') throw new Error('Only published blogs can be unpublished');
    const { data, error } = await this.db
      .from('Blog')
      .update({ status: 'draft', isPublished: false, publishedAt: null })
      .eq('id', blogId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async approveBlog(blogId: string, approvedBy: string, notes?: string) {
    const { data, error } = await this.db
      .from('Blog')
      .update({ approvedAt: new Date().toISOString(), approvedBy })
      .eq('id', blogId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async rejectBlog(blogId: string, reason: string) {
    const { data, error } = await this.db
      .from('Blog')
      .update({ status: 'draft', rejectionReason: reason, approvedAt: null, approvedBy: null })
      .eq('id', blogId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getAdminBlogs(filter: any, options: { limit?: number; offset?: number } = {}) {
    const { limit = 20, offset = 0 } = options;

    let query = this.db
      .from('Blog')
      .select('id, title, slug, excerpt, category, authorName, authorImage, authorRole, authorId, featuredImage, status, visibility, isPublished, readTime, views, publishedAt, createdAt, updatedAt, tags:BlogTag(tag:Tag(name))', { count: 'exact' })
      .order('updatedAt', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filter conditions
    if (filter.isPublished !== undefined) query = query.eq('isPublished', filter.isPublished);
    if (filter.status) query = query.eq('status', filter.status);
    if (filter.authorId) query = query.eq('authorId', filter.authorId);

    const { data: blogs, count } = await query;
    return {
      success: true,
      data: (blogs || []).map((b) => this.mapTags(b)),
      pagination: { total: count || 0, limit, offset, hasMore: offset + (blogs?.length || 0) < (count || 0) },
    };
  }

  async getAdminBlogDetail(blogId: string) {
    const { data } = await this.db
      .from('Blog')
      .select('*, tags:BlogTag(tag:Tag(name))')
      .eq('id', blogId)
      .single();
    return data ? this.mapTags(data) : null;
  }
}
