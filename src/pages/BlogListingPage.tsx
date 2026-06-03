import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { SteamiLayout } from '@/components/SteamiLayout';
import { useBlogStore } from '@/stores/blog-store';
import { useThemeStore } from '@/stores/theme-store';
import { CardSvgVisual } from '@/components/CardSvgVisual';
import { fadeInUp } from '@/lib/motion';
import { AnimatedSection, AnimatedCard } from '@/components/MotionWrappers';
import { api, apiAssetUrl } from '@/lib/api';

const getDeviceType = (): string => {
  const ua = navigator.userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm/.test(ua)) return 'mobile';
  return 'desktop';
};

/** Fire-and-forget event when a blog card is clicked — captures intent signal. */
const logBlogClick = (post: any) => {
  api.dashboard.event({
    popup_type:  'ai_insight',
    popup_id:    post.id,
    popup_title: post.title ?? '',
    device_type: getDeviceType(),
  }).catch(() => {});
};

export default function BlogListingPage() {
  const { posts: localPosts } = useBlogStore();
  const [backendPosts, setBackendPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isLight = useThemeStore((s) => s.theme === 'light');
  const posts = backendPosts;

  useEffect(() => {
    setLoading(true);
    setError('');
    api.content.blogPosts()
      .then((data: any) => setBackendPosts(Array.isArray(data) ? data : data?.posts ?? data?.items ?? []))
      .catch((err: any) => {
        setError(`Backend blog API failed: ${err.message || 'Unable to fetch posts'}`);
        setBackendPosts([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <SteamiLayout>
      <motion.div className="mb-10" variants={fadeInUp} initial="hidden" animate="visible">
        <h1 className="steami-heading text-3xl md:text-4xl mb-4">Intelligence</h1>
        <p className="text-[15px] font-medium text-muted-foreground max-w-2xl leading-relaxed">
          The latest insights, discoveries, and thought pieces from across science, technology, and beyond.
        </p>
      </motion.div>

      {error && (
        <div className="mb-6 rounded-lg border border-steami-red/20 bg-steami-red/5 p-4 text-[13px] text-steami-red">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Loading intelligence posts...</div>
      ) : (
      <AnimatedSection className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post, idx) => (
          <AnimatedCard key={post.id} index={idx} className="h-full">
            <Link
              to={`/blog/${post.id}`}
              className="glass-card flex flex-col h-full overflow-hidden group"
              onClick={() => logBlogClick(post)}
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={apiAssetUrl(post.coverImage) || localPosts[0]?.coverImage}
                  alt={post.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: isLight
                      ? 'linear-gradient(180deg, transparent 40%, rgba(255,255,255,0.95) 100%)'
                      : 'linear-gradient(180deg, transparent 40%, rgba(2,8,23,0.95) 100%)',
                  }}
                />
                <CardSvgVisual field={post.field} variant="mini" className="absolute bottom-2 right-2 opacity-50" />
              </div>

              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`steami-badge steami-badge-${post.badgeColor} text-[10px]`}>
                    {post.field}
                  </span>
                </div>
                <h2 className="font-serif text-[17px] font-bold text-foreground mb-2 leading-snug line-clamp-2">
                  {post.title}
                </h2>
                <p className="text-[14px] font-medium text-muted-foreground leading-relaxed line-clamp-3 flex-1 mb-4">
                  {post.description}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-foreground/5 mt-auto">
                  <div className="flex items-center gap-2">
                    <img src={apiAssetUrl(post.author?.avatar) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author?.name || 'STEAMI'}`} alt={post.author?.name || 'STEAMI'} className="w-6 h-6 rounded-full" />
                    <span className="font-mono text-[11px] text-muted-foreground">{post.author?.name || 'STEAMI'}</span>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">{post.publishDate}</span>
                </div>
              </div>
            </Link>
          </AnimatedCard>
        ))}
      </AnimatedSection>
      )}

      {posts.length === 0 && (
        <div className="text-center py-20">
          <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">No intelligence posts found</p>
        </div>
      )}
    </SteamiLayout>
  );
}
