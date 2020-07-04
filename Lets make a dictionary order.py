You need to input N words one on each line and output should be lexicographically sorted i.e the words which comes as a output should be alphabetically sorted 

Input Format
You will be taking an integer N from STDIN. 
Following N lines contains string one on each line.

Constraints
1 < N < 10000
1 < |S| < 1000


Output Format
The words should be lexicographically sorted and should be displayed one per each line.

N = int(input())
data = []
for i in range(N):
    data.append(str(input()))
data = sorted(data)
for i in range(N):
    if i == N-1:
        print(data[i], end = "")
    else:
        print(data[i])
