/**
 * 快照栈:记录画板每次变更的快照,支持撤销/重做。
 */
import type { GraphPath } from './types';

import { STACK_LIMIT } from './const';

/** 一次快照 = 当前全部图形 */
type Snapshot = GraphPath[];

export default class Stack {
  private list: Snapshot[] = [];

  /** 当前指针:指向 list 中「当前生效」的快照 */
  private flag = -1;

  private limit: number;

  constructor(limit: number = STACK_LIMIT) {
    this.limit = limit;
  }

  /** 当前快照 */
  get item(): Snapshot | undefined {
    return this.flag >= 0 ? this.list[this.flag] : undefined;
  }

  get length(): number {
    return this.list.length;
  }

  /** 压入新快照:截断指针之后的重做分支,超容量则丢弃最旧 */
  insert(state: Snapshot): void {
    const { length } = this.list;
    this.flag++;
    this.list.splice(this.flag, length - this.flag, state);
    if (length >= this.limit) {
      this.flag--;
      this.list.shift();
    }
  }

  /** 撤销:指针前移 */
  prev(): void {
    if (this.flag >= 0) this.flag--;
  }

  /** 重做:指针后移 */
  next(): void {
    if (this.list.length - 1 > this.flag) this.flag++;
  }

  reset(): void {
    this.list = [];
    this.flag = -1;
  }
}
