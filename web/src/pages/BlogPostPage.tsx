import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen, ChevronRight, Clock } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageHero } from '../components/layout/PageHero';
import { PostCard } from '../components/blog/PostCard';
import { Button } from '../components/ui/Button';
import { usePageMeta } from '../hooks/usePageMeta';
import { BLOG_POSTS, BlogBlock, formatPostDate, postBySlug } from '../blog';
import NotFoundPage from './NotFoundPage';

const breadcrumbLink = 'hover:text-[#183321] hover:underline underline-offset-2';

const Block: React.FC<{ block: BlogBlock }> = ({ block }) => {
  switch (block.type) {
    case 'h2':
      return <h2 className="text-2xl font-bold text-[#18261E] tracking-tight pt-4">{block.text}</h2>;
    case 'ul':
      return (
        <ul className="space-y-2.5 pl-1">
          {block.items.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-[9px] w-1.5 h-1.5 rounded-full bg-[#2C573A] shrink-0" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    default:
      return <p>{block.text}</p>;
  }
};

export default function BlogPostPage() {
  usePageMeta();
  const { slug } = useParams();
  const post = postBySlug(slug);
  if (!post) return <NotFoundPage />;

  const more = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <>
      <PageHeader>
        <PageHero
          eyebrow={post.category}
          eyebrowIcon={BookOpen}
          title={post.title}
          subtitle={post.excerpt}
          image={post.image}
          imageAlt={post.title}
        >
          <div className="flex items-center gap-2 text-sm text-[#637265]">
            <time dateTime={post.date}>{formatPostDate(post.date)}</time>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {post.readMinutes} min read
            </span>
          </div>
        </PageHero>
      </PageHeader>

      <nav aria-label="Breadcrumb" className="mt-5 px-1 flex items-center gap-1.5 text-xs text-[#637265] min-w-0">
        <Link to="/" className={breadcrumbLink}>
          Home
        </Link>
        <ChevronRight className="w-3 h-3 shrink-0" />
        <Link to="/blog" className={breadcrumbLink}>
          Blog
        </Link>
        <ChevronRight className="w-3 h-3 shrink-0" />
        <span className="font-semibold text-[#254A32] truncate" aria-current="page">
          {post.title}
        </span>
      </nav>

      <section className="mt-4 sm:mt-6">
        <div className="bg-white rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-14 shadow-xs">
          <article className="max-w-[68ch] mx-auto space-y-5 text-[15px] sm:text-base text-[#3F4F43] leading-[1.75]">
            {post.body.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </article>

          <div className="max-w-[68ch] mx-auto mt-10 rounded-3xl bg-[#F4F6F2] border border-[#E1E7DE] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#18271E] tracking-tight">Come and see it for yourself</h2>
              <p className="text-sm text-[#5A695D] mt-1">Beds, surf lessons and desks, five minutes from Weligama Bay.</p>
            </div>
            <Button variant="primary" book className="shrink-0 justify-center">
              <span>Book Now</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </section>

      {more.length > 0 && (
        <section className="mt-6 sm:mt-10">
          <div className="bg-white rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 shadow-xs">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
              <h2 className="text-2xl font-bold text-[#18261E] tracking-tight">More from the blog</h2>
              <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#254A32] hover:gap-2.5 transition-all">
                <span>All articles</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {more.map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
