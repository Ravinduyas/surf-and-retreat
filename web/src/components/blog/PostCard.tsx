import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import { BlogPost, formatPostDate } from '../../blog';
import { Photo } from '../ui/Photo';

/** Blog card. `featured` lays it out wide, photo beside text, for the top of the index. */
export const PostCard: React.FC<{ post: BlogPost; featured?: boolean }> = ({ post, featured }) => (
  <Link
    to={`/blog/${post.slug}`}
    className={`group bg-[#F7F8F5] hover:bg-white border border-[#E1E7DE] rounded-3xl overflow-hidden transition-all duration-200 shadow-xs hover:shadow-md flex flex-col ${
      featured ? 'lg:flex-row' : ''
    }`}
  >
    <div
      className={`relative overflow-hidden bg-[#E9EEE5] ${
        featured ? 'h-56 sm:h-72 lg:h-auto lg:min-h-[340px] lg:w-[55%] shrink-0' : 'h-48'
      }`}
    >
      <Photo
        src={post.image}
        alt={post.title}
        sizes={featured ? '(max-width: 1024px) 100vw, 55vw' : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
      />
      <span className="absolute top-3 left-3 inline-block bg-white/95 text-[#1D3624] text-[11px] font-semibold px-3 py-1 rounded-full shadow-xs">
        {post.category}
      </span>
    </div>

    <div className={`flex flex-col flex-1 gap-3 ${featured ? 'p-6 sm:p-8 lg:p-10 justify-center' : 'p-5 sm:p-6'}`}>
      <div className="flex items-center gap-2 text-[11px] font-medium text-[#7A8A7D]">
        <time dateTime={post.date}>{formatPostDate(post.date)}</time>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {post.readMinutes} min read
        </span>
      </div>
      <h3
        className={`${
          featured ? 'text-2xl sm:text-3xl' : 'text-[17px]'
        } font-bold text-[#18271E] tracking-tight leading-snug group-hover:text-[#265337] transition-colors`}
      >
        {post.title}
      </h3>
      <p className={`${featured ? 'text-sm sm:text-base' : 'text-[13px]'} text-[#5A695D] leading-relaxed`}>
        {post.excerpt}
      </p>
      <span className="mt-auto pt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[#254A32] transition-all group-hover:gap-2.5">
        <span>Read article</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </div>
  </Link>
);
