export const apiUrl = `https://jsonplaceholder.typicode.com/posts`;

export function apiDetailUrl(postId: number) {
    return `${apiUrl}/${postId}`;
}
