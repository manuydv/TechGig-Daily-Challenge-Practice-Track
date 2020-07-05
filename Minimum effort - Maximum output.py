For this challenge, Given an unsorted array arr[0..n-1] of size n, find the minimum length subarray arr[s..e] such that sorting this subarray makes the whole array sorted. 

Input Format
On the first line, you need to take an integer input which will be the length of the array. Another line will have space separated integer values. 

Constraints
1 < n < 10^5
1 < A[i] < 10^5

Output Format
Space separated integer values present in the subarray. 

Sample TestCase 1

Input
13
1 2 4 7 10 11 7 12 3 7 16 18 19


N = list(map(int, input().split()))[0]
array = list(map(int, input().split()))
array_sorted = sorted(array)

index = []
for i in range(N):
    if array[i] != array_sorted[i]:
        index.append(i)

new = array[index[0]:index[-1]+1]
print(*new, sep = ' ', end = "")
