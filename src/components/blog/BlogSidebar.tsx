import { ShareMenu } from '@/components/ShareMenu';
import { AuthorCard } from './AuthorCard';
import { TableOfContents } from './TableOfContents';

interface Post {
  title:   string;
  content: string;
  tags:    string[];
  author: {
    name:   string;
    role:   string;
    avatar: string;
    bio:    string;
  };
}

interface BlogSidebarProps {
  post: Post;
}

export function BlogSidebar({ post }: BlogSidebarProps) {
  return (
    <div className="flex flex-col gap-6">
      <TableOfContents content={post.content} />

      <AuthorCard
        name={post.author.name}
        role={post.author.role}
        avatar={post.author.avatar}
        bio={post.author.bio}
      />

      <div className="flex justify-center mb-2">
        <ShareMenu title={post.title} compact={false} />
      </div>

      {post.tags.length > 0 && (
        <div>
          <h4 className="font-mono text-[11px] tracking-wider uppercase text-steami-cyan mb-3 px-2">Tags</h4>
          <div className="flex flex-wrap gap-2 px-2">
            {post.tags.map(tag => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-[11px] font-mono text-muted-foreground bg-foreground/5 hover:bg-foreground/10 transition-colors cursor-pointer"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
