export type StoryPage = {
  image: string;
  alt: string;
  paragraph: string;
  audio?: string;
  audioTimings?: string;
};

export type Story = {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: string;
  language?: string;
  coverImage: string;
  pages: StoryPage[];
};

export type StoriesResponse = {
  stories: Story[];
};

export type StoryProgress = {
  pageIndex: number;
  wordIndex: number;
  completed: boolean;
};

export type ProgressMap = Record<string, StoryProgress>;
