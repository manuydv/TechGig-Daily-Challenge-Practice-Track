For this challenge, you need to take a matrix as an input from the stdin , transpose it and print the resultant matrix to the stdout. 

Input Format
A matrix is to be taken as input from stdin. On first line you need to tell that how many rows and columns your matrix need to have and these values should be separated by space. Below lines will represent the elements of the matrix where each line will represent the row of the matrix.

Constraints
1 < (n,m) < 100

Output Format
Print the resultant matrix to the stdout where each line should represent each row and values in the row should be separated by a space. 


dim = list(map(int, input().split()))
m = dim[0]
n = dim[1]


matrix1 = [] 

for i in range(m):
    matrix1.append(list(map(int, input().split())))

matrix = [ [ 0 for i in range(m) ] for j in range(n) ] 

for i in range(m):
   for j in range(n):
       matrix[j][i] = matrix1[i][j]

for i in range(n):
    if i == n-1:
         print(" ".join(str(x) for x in matrix[i]), end = "")
    else:
        print(" ".join(str(x) for x in matrix[i]))
