/** GitHub repo 連結（GitHub App 安裝流程） */
export interface CompleteInstallationInput {
  state: string;
  code: string | null;
  installationId: number | null;
  setupAction: string | null;
}

export interface GithubRepository {
  id: number;
  fullName: string;
  htmlUrl: string;
  private: boolean;
}

export interface LinkResult {
  /** linked 已連結；pending 等待 repo 擁有者核准；choose_repo 安裝沒有包含填寫的 repo，請從授權的 repo 中選擇 */
  status: 'linked' | 'pending' | 'choose_repo';
  repoFullName: string | null;
  repositories: GithubRepository[];
}
