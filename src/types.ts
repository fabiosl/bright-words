export type StoryPage = {
  image: string;
  alt: string;
  paragraph: string;
};

export type Story = {
  id: string;
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
