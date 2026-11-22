import type { ReactNode } from 'react';
import { Reveal } from './Reveal';

interface Props {
  index: string;
  name: string;
  id: string;
  children: ReactNode;
}

export function ChapterHead({ index, name, id, children }: Props) {
  return (
    <Reveal as="header" className="chapter__head">
      <p className="chapter__index label label--cobalt">
        <span>{index}</span>
        <span>{name}</span>
      </p>
      <h2 id={id} className="chapter__title">
        {children}
      </h2>
    </Reveal>
  );
}
