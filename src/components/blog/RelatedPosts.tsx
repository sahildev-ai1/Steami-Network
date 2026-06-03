import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CardMedia } from '@/components/CardMedia';
import { CardSvgVisual } from '@/components/CardSvgVisual';
import { AnimatedSection, AnimatedCard } from '@/components/MotionWrappers';

interface Post {
  id:          string;
  title:       string;
  subtitle?:   string;
  description?: string;
  field:       string;
  badgeColor:  string;
  readingTime: string;
  coverImage?: string;
}

interface RelatedPostsProps {
  posts: Post[];
}

export function RelatedPosts({ posts }: RelatedPostsProps) {
  const navigate = useNavigate();
  if (posts.length === 0) return null;

  return (
    <div className="mt-16 border-t border-foreground/10 pt-12">
      <h3 className="font-serif text-2xl font-extrabold mb-8 text-center text-foreground">
        Related Intelligence
      </h3>
      <AnimatedSection className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post, idx) => (
          <AnimatedCard
            key={post.id}
            index={idx}
            className="relative cursor-pointer overflow-hidden group flex flex-col"
            onClick={() => navigate(`/blog/${post.id}`)}
          >
            <div
              className="h-[2px] w-full"
              style={{ background: `linear-gradient(90deg, hsl(var(--steami-${post.badgeColor})) 0%, transparent 100%)` }}
            />
            <CardMedia src={post.coverImage} alt={post.title} badgeColor={post.badgeColor} height={160} />
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <span className={`steami-badge steami-badge-${post.badgeColor} text-[16px] inline-block`}>
                  {post.field}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h4 className="font-serif text-[18px] font-extrabold mb-2 leading-snug text-foreground">
                    {post.title}
                  </h4>
                  <p className="text-[14px] font-medium text-muted-foreground leading-relaxed line-clamp-2 mb-4">
                    {post.subtitle || post.description || ''}
                  </p>
                </div>
                <CardSvgVisual field={post.field} variant="mini" className="hidden sm:flex mt-0.5 shrink-0" />
              </div>
              <div className="mt-auto flex items-center justify-between pt-3 border-t border-foreground/5">
                <span className="text-[11px] font-mono text-muted-foreground/60 tracking-wider">
                  {post.readingTime}
                </span>
                <span className="text-[11px] font-mono text-steami-cyan tracking-wider uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                  Read →
                </span>
              </div>
            </div>
          </AnimatedCard>
        ))}
      </AnimatedSection>
    </div>
  );
}
