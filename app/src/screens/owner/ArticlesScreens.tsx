/**
 * Short reads. The list and reader use the app's own components; the article
 * text itself is English for now, which the Spanish UI says plainly.
 */
import { useState } from 'react'
import { ARTICLES, articleBySlug } from '../../content/articles'
import { useT, type MessageKey } from '../../i18n'
import { useNav } from '../../state/nav'
import { ListRow, Screen, SectionTitle } from '../../ui/kit'

const CATEGORY_KEY: Record<string, MessageKey> = {
  'Cycle basics': 'articles.cat.basics',
  Symptoms: 'articles.cat.symptoms',
  Fertility: 'articles.cat.fertility',
  Pregnancy: 'articles.cat.pregnancy',
  Perimenopause: 'articles.cat.peri',
  Privacy: 'articles.cat.privacy',
}

export function ArticlesScreen() {
  const t = useT()
  const { pop, push } = useNav()
  const [query, setQuery] = useState('')
  const q = query.trim().toLocaleLowerCase()
  const shown = q ? ARTICLES.filter((a) => [a.title, a.category, ...a.body].join(' ').toLocaleLowerCase().includes(q)) : ARTICLES
  const categories = [...new Set(shown.map((a) => a.category))]
  const catName = (c: string) => (CATEGORY_KEY[c] ? t(CATEGORY_KEY[c]) : c)

  return (
    <Screen title={t('you.articles')} onBack={pop}>
      {t.locale !== 'en' && <p className="mz-gutter mz-body-sm mz-muted">{t('articles.englishOnly')}</p>}
      <div className="mz-section">
        <label className="mz-field">
          <span className="mz-field__label">{t('articles.search')}</span>
          <input className="mz-input" type="search" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
        </label>
      </div>
      <p className="mz-sr-only" role="status" aria-live="polite">
        {q ? t.n('articles.results', shown.length) : ''}
      </p>
      {shown.length === 0 && <p className="mz-gutter mz-body-sm mz-muted">{t('articles.none')}</p>}
      {categories.map((c) => (
        <section key={c}>
          <SectionTitle>{catName(c)}</SectionTitle>
          <div className="mz-section mz-list">
            {shown
              .filter((a) => a.category === c)
              .map((a) => (
                <ListRow
                  key={a.slug}
                  icon="book-open"
                  title={a.title}
                  sub={t.n('articles.minutes', a.minutes)}
                  onClick={() => push({ name: 'article', slug: a.slug })}
                />
              ))}
          </div>
        </section>
      ))}
    </Screen>
  )
}

export function ArticleReader({ slug }: { slug: string }) {
  const t = useT()
  const { pop } = useNav()
  const a = articleBySlug(slug)
  if (!a) return null
  return (
    <Screen title={CATEGORY_KEY[a.category] ? t(CATEGORY_KEY[a.category]) : a.category} onBack={pop}>
      <article className="mz-section mz-stack" lang="en" style={{ gap: 16 }}>
        <h1 className="mz-title-lg">{a.title}</h1>
        <p className="mz-caption">{t.n('articles.minutes', a.minutes)}</p>
        {a.body.map((p, i) => (
          <p key={i} className="mz-body" style={{ lineHeight: 1.6 }}>{p}</p>
        ))}
      </article>
      <p className="mz-gutter mz-caption" style={{ marginTop: 16 }}>{t('articles.disclaimer')}</p>
    </Screen>
  )
}
