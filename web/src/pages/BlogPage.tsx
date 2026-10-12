import React from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageHero } from '../components/layout/PageHero';
import { PostCard } from '../components/blog/PostCard';
import { Button } from '../components/ui/Button';
import { useReveal } from '../components/ui/Reveal';
import { usePageMeta } from '../hooks/usePageMeta';
import { BLOG_POSTS } from '../blog';

export default function BlogPage() {
  usePageMeta();
  const gridRef = useReveal<HTMLDivElement>();
  const [featured, ...rest] = BLOG_POSTS;

  return (
    <>
      <PageHeader>
        <PageHero
          eyebrow="Blog"
          eyebrowIcon={BookOpen}
          title={
            <>
              Stories from
              <br />
              <span className="text-[#2C573A]">Weligama Bay.</span>
            </>
          }
          subtitle="Surf seasons, travel tips, remote-work know-how and the best things to do on Sri Lanka's south coast, written by the people who live here."
          image={featured?.image}
          imageAlt={featured?.title}
        >
          <Button variant="primary" book>
            <span>Book Your Stay</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </PageHero>
      </PageHeader>

      <section className="mt-6 sm:mt-10">
        <div className="bg-white rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-xs">
          {featured && <PostCard post={featured} featured />}
          {rest.length > 0 && (
            <div ref={gridRef} className="stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mt-4 sm:mt-5">
              {rest.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
