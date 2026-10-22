import type {Dispatch,SetStateAction} from 'react';
import type {FullAppData} from './model';
export type Props={data:FullAppData;setData:Dispatch<SetStateAction<FullAppData>>;onBack:()=>void};
